const { google } = require("googleapis");
const fs = require("fs");

exports.upload = async (videoPath, title) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });

  const res = await youtube.videos.insert({
    part: "snippet,status",
    requestBody: {
      snippet: {
        title,
        description: "AI generated video",
        tags: ["AI", "motivation", "facts"],
      },
      status: {
        privacyStatus: "public", // safer for testing
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  console.log("Uploaded:", res.data.id);
};
