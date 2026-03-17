const ffmpeg = require("fluent-ffmpeg");

exports.createVideo = async (topic, audioPath) => {

 const output = "storage/videos/video.mp4";

 return new Promise((resolve, reject) => {

  ffmpeg("storage/clips/clip.mp4")
   .input("storage/file/voice.mp3")
   .outputOptions("-shortest")
   .save(output)
   .on("end", () => resolve(output))
   .on("error", reject);

 });
};