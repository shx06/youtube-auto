const axios = require("axios");

function extractJsonFromText(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    // Continue with extraction strategies.
  }

  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (_) {
      // Continue with extraction strategies.
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {
      return null;
    }
  }

  return null;
}

function normalizeScriptPayload(raw, topic) {
  const fallbackNarration = `This is a short motivational narration about ${topic}. Stay focused, keep improving, and execute your goals with discipline every day.`;
  const payload = raw && typeof raw === "object" ? raw : {};

  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : `Motivation on ${topic}`;

  const description = typeof payload.description === "string" && payload.description.trim()
    ? payload.description.trim()
    : `AI-generated motivational short about ${topic}.`;

  const narration = typeof payload.narration === "string" && payload.narration.trim()
    ? payload.narration.trim()
    : fallbackNarration;

  const keywords = Array.isArray(payload.keywords)
    ? payload.keywords.filter((k) => typeof k === "string" && k.trim()).map((k) => k.trim())
    : [topic, "motivation", "discipline", "focus"];

  const sceneQueries = Array.isArray(payload.sceneQueries)
    ? payload.sceneQueries.filter((k) => typeof k === "string" && k.trim()).map((k) => k.trim())
    : keywords.slice(0, 3);

  while (sceneQueries.length < 3) {
    sceneQueries.push(keywords[sceneQueries.length % keywords.length] || topic);
  }

  return {
    title,
    description,
    narration,
    keywords: keywords.slice(0, 8),
    sceneQueries: sceneQueries.slice(0, 3),
  };
}

exports.generateScript = async (topic) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: [
              "Return valid JSON only.",
              "Create YouTube Shorts content for this topic:",
              topic,
              "Schema:",
              "{",
              '  \"title\": \"string\",',
              '  \"description\": \"string\",',
              '  \"narration\": \"120-170 words, conversational human tone with contractions and pauses, short punchy lines\",',
              '  \"keywords\": [\"string\", \"string\"],',
              '  \"sceneQueries\": [\"visual search phrase 1\", \"visual search phrase 2\", \"visual search phrase 3\"]',
              "}",
              "Narration rules: sound like a confident human creator talking directly to one person.",
              "Use natural contractions (you're, don't, it's), occasional rhetorical questions, and emotional pacing.",
              "No markdown, no extra keys.",
            ].join("\n"),
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

    const rawContent = response?.data?.choices?.[0]?.message?.content;
    const jsonPayload = extractJsonFromText(rawContent);
    return normalizeScriptPayload(jsonPayload, topic);
  } catch (err) {
    console.error("Groq Error:", err.response?.data || err.message);
    throw err;
  }
};
