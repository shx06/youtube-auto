const topicService = require("../services/topic.service");
const scriptService = require("../services/script.service");
const ttsService = require("../services/tts.service");
const videoService = require("../services/video.service");
const uploadService = require("../services/upload.service");
const { fetchVideos } = require("../services/video.fetcher");
const fs = require("fs");
const path = require("path");

function pickRandom(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)];
}

function getBackgroundMusicPath() {
  const bgmDir = path.join(__dirname, "../storage/audio/bgm");
  if (!fs.existsSync(bgmDir)) {
    return null;
  }

  const files = fs
    .readdirSync(bgmDir)
    .filter((name) => /\.(mp3|wav|m4a)$/i.test(name));

  const selected = pickRandom(files);
  return selected ? path.join(bgmDir, selected) : null;
}

function estimateTargetClipCount(narration) {
  const wordCount = String(narration || "").trim().split(/\s+/).filter(Boolean).length;
  const estimated = Math.ceil(wordCount / 16);
  return Math.max(6, Math.min(18, estimated));
}

module.exports = async function runPipeline() {
  console.log("Step 1: Getting topic...");
  const topic = await topicService.getTopic();

  console.log("Step 2: Generating script...");
  const scriptPlan = await scriptService.generateScript(topic);

  console.log("Step 3: Generating voice...");
  const audioPath = await ttsService.generateVoice(scriptPlan.narration);

  const fallbackKeywords = ["motivation", "success", "gym", "focus", "discipline"];
  const sceneQueries = (scriptPlan.sceneQueries && scriptPlan.sceneQueries.length
    ? scriptPlan.sceneQueries
    : [...(scriptPlan.keywords || []), ...fallbackKeywords].slice(0, 3)
  ).slice(0, 3);
  const targetClipCount = estimateTargetClipCount(scriptPlan.narration);
  console.log("Target clip count:", targetClipCount);

  console.log("Step 3.5: Fetching video...");
  const sceneClipPaths = [];
  for (let i = 0; i < targetClipCount; i += 1) {
    const sceneQuery = sceneQueries[i % sceneQueries.length];
    console.log(`Fetching clip ${i + 1}/${targetClipCount}:`, sceneQuery);
    const clips = await fetchVideos(sceneQuery, 1, { prefix: `scene-${i + 1}` });
    if (clips[0]) {
      sceneClipPaths.push(clips[0]);
    }
  }

  if (!sceneClipPaths.length) {
    throw new Error("Unable to fetch scene clips");
  }

  const bgmPath = getBackgroundMusicPath();
  if (bgmPath) {
    console.log("Using background music:", bgmPath);
  } else {
    console.log("No background music file found in storage/audio/bgm (optional)");
  }

  console.log("Step 4: Creating video...");
  const finalVideoPath = await videoService.createVideo(sceneClipPaths, audioPath, {
    subtitlesText: scriptPlan.narration,
    subtitleStyle: {
      FontName: "Arial Bold",
      FontSize: 14,
      Outline: 3,
      MarginV: 120,
    },
    bgmPath,
    bgmVolume: 0.16,
  });

  console.log("Step 5: Uploading...");
  await uploadService.upload(
    finalVideoPath,
    scriptPlan.title || topic,
    scriptPlan.description,
  );

  console.log("Pipeline complete!");
};