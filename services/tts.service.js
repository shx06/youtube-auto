const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const polly = new PollyClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function escapeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanNarration(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/[#*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSsml(text) {
  const cleaned = cleanNarration(text)
    .replace(/([.!?])\s+/g, "$1 <break time=\"420ms\"/> ")
    .replace(/,\s+/g, ", <break time=\"170ms\"/> ");

  const escaped = escapeXml(cleaned);
  return `<speak><prosody rate="92%" pitch="+2%">${escaped}</prosody></speak>`;
}

function synthesizePollyToFile(params, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await polly.send(new SynthesizeSpeechCommand(params));
      const audioStream = response.AudioStream;
      const writeStream = fs.createWriteStream(outputPath);
      audioStream.pipe(writeStream);
      writeStream.on("finish", () => resolve(outputPath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function synthesizeWithFallbacks(text, outputPath, voiceId, preferredEngine) {
  const attempts = [
    {
      label: "ssml preferred",
      params: {
        OutputFormat: "mp3",
        Text: buildSsml(text),
        TextType: "ssml",
        VoiceId: voiceId,
        Engine: preferredEngine,
      },
    },
    {
      label: "ssml standard",
      params: {
        OutputFormat: "mp3",
        Text: buildSsml(text),
        TextType: "ssml",
        VoiceId: voiceId,
        Engine: "standard",
      },
    },
    {
      label: "plain preferred",
      params: {
        OutputFormat: "mp3",
        Text: cleanNarration(text),
        VoiceId: voiceId,
        Engine: preferredEngine,
      },
    },
    {
      label: "plain standard",
      params: {
        OutputFormat: "mp3",
        Text: cleanNarration(text),
        VoiceId: voiceId,
        Engine: "standard",
      },
    },
  ];

  let lastError;
  let neuralFallbackLogged = false;
  for (const attempt of attempts) {
    try {
      await synthesizePollyToFile(attempt.params, outputPath);
      return {
        usedEngine: attempt.params.Engine,
        usedMode: attempt.label,
      };
    } catch (err) {
      lastError = err;
      const isUnsupportedNeural = String(err.message || "").toLowerCase().includes("unsupported neural feature");
      if (isUnsupportedNeural && !neuralFallbackLogged) {
        console.log("Polly neural engine is not available for this voice/region. Falling back to standard engine.");
        neuralFallbackLogged = true;
        continue;
      }
      console.warn(`Polly attempt failed (${attempt.label}):`, err.message);
    }
  }

  throw lastError;
}

function masterVoice(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters([
        "highpass=f=80",
        "lowpass=f=12000",
        "acompressor=threshold=-20dB:ratio=2.4:attack=20:release=220:makeup=3",
        "loudnorm=I=-16:LRA=7:TP=-1.5",
      ])
      .audioCodec("libmp3lame")
      .audioBitrate("192k")
      .format("mp3")
      .save(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject);
  });
}

exports.generateVoice = async (text) => {
  try {
    const outputDir = path.join(__dirname, "../storage/audio");
    const outputPath = path.join(outputDir, "voice.mp3");
    const rawOutputPath = path.join(outputDir, "voice.raw.mp3");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const voiceId = process.env.POLLY_VOICE_ID || "Matthew";
    const engine = process.env.POLLY_ENGINE || "standard";
    const synthesisInfo = await synthesizeWithFallbacks(text, rawOutputPath, voiceId, engine);

    try {
      await masterVoice(rawOutputPath, outputPath);
    } catch (masterErr) {
      console.warn("Voice mastering failed, using raw voice:", masterErr.message);
      fs.copyFileSync(rawOutputPath, outputPath);
    }

    console.log(
      "Voice generated:",
      outputPath,
      `(voice=${voiceId}, engine=${synthesisInfo.usedEngine}, mode=${synthesisInfo.usedMode})`,
    );
    return outputPath;

  } catch (err) {
    console.error("Polly Error:", err);
    throw err;
  }
};