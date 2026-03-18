const axios = require("axios");

exports.generateScript = async (topic) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: `Write:
              1. YouTube title
              2. Description
              3. 150-word script
              Topic: ${topic}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("Groq Error:", err.response?.data || err.message);
    throw err;
  }
};
