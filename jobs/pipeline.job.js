const topicService = require("../services/topic.service");
const scriptService = require("../services/script.service");
const ttsService = require("../services/tts.service");
const videoService = require("../services/video.service");
const uploadService = require("../services/upload.service");

module.exports = async function runPipeline() {

  console.log("Step 1: Getting topic...");
  const topic = await topicService.getTopic();

  console.log("Step 2: Generating script...");
  const script = await scriptService.generateScript(topic);

  console.log("Step 3: Generating voice...");
  const audioPath = await ttsService.generateVoice(script);

  console.log("Step 4: Creating video...");
  const videoPath = await videoService.createVideo(topic, audioPath);

  console.log("Step 5: Uploading...");
  await uploadService.upload(videoPath, topic);

  console.log("Pipeline complete!");
};