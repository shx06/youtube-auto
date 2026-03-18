const axios = require("axios");
const fs = require("fs");
const path = require("path");

exports.fetchVideo = async (query) => {
  try {
    const res = await axios.get("https://api.pexels.com/videos/search", {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
      params: {
        query,
        per_page: 1,
      },
    });

    const videoUrl =
      res.data.videos[0].video_files.find(v => v.quality === "sd")?.link;

    if (!videoUrl) throw new Error("No video found");

    const outputDir = path.join(__dirname, "../storage/clips");
    const outputPath = path.join(outputDir, "clip.mp4");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const videoStream = await axios({
      method: "GET",
      url: videoUrl,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(outputPath);
    videoStream.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log("🎬 Video downloaded:", outputPath);
        resolve(outputPath);
      });
      writer.on("error", reject);
    });

  } catch (err) {
    console.error("Pexels Error:", err.message);
    throw err;
  }
};