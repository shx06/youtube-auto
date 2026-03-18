const topicService = require("../services/topic.service");
const scriptService = require("../services/script.service");
const ttsService = require("../services/tts.service");
const videoService = require("../services/video.service");
const uploadService = require("../services/upload.service");
const { fetchVideo } = require("../services/video.fetcher");

module.exports = async function runPipeline() {
  console.log("Step 1: Getting topic...");
  const topic = await topicService.getTopic();

  console.log("Step 2: Generating script...");
  const script = await scriptService.generateScript(topic);

  console.log("Step 3: Generating voice...");
  const audioPath = await ttsService.generateVoice(script);

  // ✅ ADD THIS (missing part)
  const keywords = ["motivation", "success", "gym", "focus", "discipline"];
  const query = keywords[Math.floor(Math.random() * keywords.length)];

  console.log("Step 3.5: Fetching video...");
  const videoClipPath = await fetchVideo(query);

  console.log("Step 4: Creating video...");
  const finalVideoPath = await videoService.createVideo(videoClipPath, audioPath);

  console.log("Step 5: Uploading...");
  await uploadService.upload(finalVideoPath, topic);

  console.log("Pipeline complete!");
};