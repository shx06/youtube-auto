const fs = require("fs");
const path = require("path");

exports.generateVoice = async () => {

  const dirPath = path.join(__dirname, "../storage/audio");
  const filePath = path.join(dirPath, "voice.mp3"); // ✅ match ffmpeg

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, ""); // dummy file

  return filePath;
};