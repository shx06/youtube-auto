const fs = require("fs");
const path = require("path");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");

const polly = new PollyClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

exports.generateVoice = async (text) => {
  try {
    const outputDir = path.join(__dirname, "../storage/audio");
    const outputPath = path.join(outputDir, "voice.mp3");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const command = new SynthesizeSpeechCommand({
      OutputFormat: "mp3",
      Text: text,
      VoiceId: "Joanna", // 🔥 change later if needed
      Engine: "neural", // better quality
    });

    const response = await polly.send(command);

    const audioStream = response.AudioStream;

    const writeStream = fs.createWriteStream(outputPath);
    audioStream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log("🎤 Polly voice generated:", outputPath);
        resolve(outputPath);
      });
      writeStream.on("error", reject);
    });

  } catch (err) {
    console.error("Polly Error:", err);
    throw err;
  }
};