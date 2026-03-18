const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

function getMediaDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata?.format?.duration || 0);
    });
  });
}

function toSubtitleFilterPath(filePath) {
  return path.resolve(filePath)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function toSubtitleStyle(style) {
  const defaultStyle = {
    FontName: "Arial",
    FontSize: 13,
    PrimaryColour: "&H00FFFFFF",
    OutlineColour: "&H00000000",
    BorderStyle: 1,
    Outline: 2,
    Shadow: 0,
    Alignment: 2,
    MarginV: 90,
  };

  const merged = { ...defaultStyle, ...(style || {}) };
  return Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join(",")
    .replace(/'/g, "\\'");
}

function toSrtTimestamp(seconds) {
  const ms = Math.max(0, Math.floor(seconds * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return [hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":") + `,${String(millis).padStart(3, "0")}`;
}

function buildSubtitleChunks(text, totalDurationSec) {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleanText) {
    return [];
  }

  const words = cleanText.split(" ");
  const maxWordsPerChunk = 7;
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    chunks.push(words.slice(i, i + maxWordsPerChunk).join(" "));
  }

  const step = totalDurationSec / chunks.length;
  return chunks.map((chunk, index) => {
    const start = index * step;
    const end = Math.min(totalDurationSec, (index + 1) * step);
    return { chunk, start, end };
  });
}

function writeSrtFile(filePath, text, totalDurationSec) {
  const chunks = buildSubtitleChunks(text, totalDurationSec);
  if (!chunks.length) {
    return false;
  }

  const lines = chunks.map((entry, index) => {
    return [
      String(index + 1),
      `${toSrtTimestamp(entry.start)} --> ${toSrtTimestamp(entry.end)}`,
      entry.chunk,
      "",
    ].join("\n");
  });

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return true;
}

exports.createVideo = async (videoPaths, audioPath, options = {}) => {
  const clips = Array.isArray(videoPaths) ? videoPaths : [videoPaths];
  if (!clips.length) {
    throw new Error("No video clips provided");
  }

  const outputDir = path.join(__dirname, "../storage/videos");
  const outputPath = path.join(outputDir, "video.mp4");
  const subtitlesPath = path.join(outputDir, "subtitles.srt");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const audioDuration = await getMediaDuration(audioPath);
  if (!audioDuration || Number.isNaN(audioDuration)) {
    throw new Error("Unable to determine audio duration");
  }

  const shouldUseSubtitles = writeSrtFile(
    subtitlesPath,
    options.subtitlesText || "",
    audioDuration,
  );
  const subtitleStyle = toSubtitleStyle(options.subtitleStyle);

  const segmentDuration = audioDuration / clips.length;
  const hasBgm = Boolean(options.bgmPath);

  function buildFilterGraph(includeSubtitles) {
    const filterGraph = [];

    clips.forEach((_, index) => {
      filterGraph.push(
        `[${index}:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,setsar=1,setpts=PTS-STARTPTS,trim=duration=${segmentDuration.toFixed(3)}[v${index}]`,
      );
    });

    const concatInputs = clips.map((_, index) => `[v${index}]`).join("");
    filterGraph.push(`${concatInputs}concat=n=${clips.length}:v=1:a=0[vbase]`);
    filterGraph.push(
      "[vbase]eq=contrast=1.05:saturation=1.10:brightness=0.015,unsharp=5:5:0.70:5:5:0.0[vgraded]",
    );

    if (includeSubtitles) {
      filterGraph.push(
        `[vgraded]subtitles='${toSubtitleFilterPath(subtitlesPath)}':force_style='${subtitleStyle}'[vout]`,
      );
    }

    const audioInputIndex = clips.length;
    const bgmInputIndex = hasBgm ? clips.length + 1 : -1;

    if (hasBgm) {
      filterGraph.push(`[${audioInputIndex}:a]aresample=48000,volume=1[aVoice]`);
      filterGraph.push(
        `[${bgmInputIndex}:a]aresample=48000,aloop=loop=-1:size=2147483647,atrim=duration=${audioDuration.toFixed(3)},volume=${(options.bgmVolume || 0.18).toFixed(2)}[aBgmBase]`,
      );
      filterGraph.push(
        `[aBgmBase][aVoice]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=250[aBgmDucked]`,
      );
      filterGraph.push(`[aVoice][aBgmDucked]amix=inputs=2:normalize=0:weights='1 0.45'[aout]`);
    } else {
      filterGraph.push(`[${audioInputIndex}:a]aresample=48000,volume=1[aout]`);
    }

    return {
      filterGraph,
      videoLabel: includeSubtitles ? "vout" : "vgraded",
    };
  }

  function render(includeSubtitles) {
    return new Promise((resolve, reject) => {
      const { filterGraph, videoLabel } = buildFilterGraph(includeSubtitles);
      const command = ffmpeg();

      clips.forEach((clipPath) => {
        command.input(clipPath).inputOptions(["-stream_loop -1"]);
      });
      command.input(audioPath);
      if (hasBgm) {
        command.input(options.bgmPath);
      }

      let stderrTail = [];
      command
        .complexFilter(filterGraph)
        .outputOptions([
          `-map [${videoLabel}]`,
          "-map [aout]",
          "-c:v libx264",
          "-preset slow",
          "-crf 18",
          "-profile:v high",
          "-level 4.2",
          "-maxrate 10M",
          "-bufsize 20M",
          "-movflags +faststart",
          "-pix_fmt yuv420p",
          "-c:a aac",
          "-b:a 256k",
          `-t ${audioDuration.toFixed(3)}`,
          "-shortest",
        ])
        .on("start", (cmdLine) => {
          console.log("FFmpeg command:", cmdLine);
        })
        .on("stderr", (line) => {
          if (stderrTail.length > 25) {
            stderrTail = stderrTail.slice(stderrTail.length - 25);
          }
          stderrTail.push(line);
        })
        .save(outputPath)
        .on("end", () => {
          console.log("Video created:", outputPath);
          resolve(outputPath);
        })
        .on("error", (err) => {
          const diagnostic = stderrTail.join("\n");
          if (diagnostic) {
            console.error("FFmpeg stderr (tail):\n", diagnostic);
          }
          reject(err);
        });
    });
  }

  try {
    return await render(shouldUseSubtitles);
  } catch (err) {
    if (shouldUseSubtitles) {
      console.warn("Subtitle render failed, retrying without subtitles...");
      return render(false);
    }
    throw err;
  }
};
