require("dotenv").config();
const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  "http://localhost"
);

const scopes = ["https://www.googleapis.com/auth/youtube.upload"];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
});

console.log("Open this URL:", url);

// 👇 ADD THIS PART
const code = "4/0AfrIepACsxmXQt7wdQgMe2KnypGEqJ2N5yKAEVEa-VWLboSO4u_YKo17lnODP7FMwSy1lQ";

oauth2Client.getToken(code).then((res) => {
  console.log("TOKENS:", res.tokens);
}).catch(err => {
  console.error("Error getting token:", err);
});