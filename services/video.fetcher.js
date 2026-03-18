const axios = require("axios");
const fs = require("fs");
const path = require("path");

function scoreVideoFile(file) {
  const width = Number(file?.width || 0);
  const height = Number(file?.height || 0);
  const fps = Number(file?.fps || 30);
  const area = width * height;
  const qualityBoost = file?.quality === "hd" ? 1.15 : 1;
  return area * (fps / 30) * qualityBoost;
}

function pickBestFile(video) {
  const files = Array.isArray(video?.video_files) ? video.video_files : [];
  const mp4Files = files.filter((f) => String(f.file_type || "").includes("mp4"));
  const candidates = mp4Files.length ? mp4Files : files;
  if (!candidates.length) {
    return null;
  }

  return candidates
    .slice()
    .sort((a, b) => scoreVideoFile(b) - scoreVideoFile(a))[0];
}

async function downloadVideo(videoUrl, outputPath) {
  const videoStream = await axios({
    method: "GET",
    url: videoUrl,
    responseType: "stream",
  });

  const writer = fs.createWriteStream(outputPath);
  videoStream.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(outputPath));
    writer.on("error", reject);
  });
}

exports.fetchVideos = async (query, count = 3, options = {}) => {
  try {
    const res = await axios.get("https://api.pexels.com/videos/search", {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
      params: {
        query,
        per_page: Math.max(count * 6, 18),
        min_duration: 5,
      },
    });

    const videos = Array.isArray(res?.data?.videos) ? res.data.videos : [];
    const links = videos
      .map((video) => {
        const best = pickBestFile(video);
        return best?.link;
      })
      .filter(Boolean);

    const uniqueLinks = [...new Set(links)].slice(0, count);

    if (!uniqueLinks.length) {
      throw new Error("No videos found");
    }

    const outputDir = path.join(__dirname, "../storage/clips");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const prefix = options.prefix || "clip";
    const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const downloadedPaths = [];
    for (let i = 0; i < uniqueLinks.length; i += 1) {
      const outputPath = path.join(outputDir, `${prefix}-${runId}-${i + 1}.mp4`);
      await downloadVideo(uniqueLinks[i], outputPath);
      downloadedPaths.push(outputPath);
      console.log("Video downloaded:", outputPath);
    }

    return downloadedPaths;
  } catch (err) {
    console.error("Pexels Error:", err.message);
    throw err;
  }
};

exports.fetchVideo = async (query) => {
  const paths = await exports.fetchVideos(query, 1);
  return paths[0];
};