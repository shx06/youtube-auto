const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

exports.createVideo = async (topic, audioPath) => {

  const outputDir = path.join(__dirname, "../storage/videos");
  const outputPath = path.join(outputDir, "video.mp4");

  // ensure output folder exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("storage/clips/clip.mp4")
      // .input(audioPath) // ✅ correct variable
      .outputOptions("-c:v copy")
      .save(outputPath)
      .on("end", () => {
        console.log("Video created:", outputPath);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err.message);
        reject(err);
      });
  });
};