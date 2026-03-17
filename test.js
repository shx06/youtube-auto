require("dotenv").config();
const axios = require("axios");

(async () => {
  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Hello" }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(res.data);

  } catch (err) {
    console.error(err.response?.data || err.message);
  }
})();