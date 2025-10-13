require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// ==== 環境変数 ====
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GAS_ENDPOINT = process.env.GAS_ENDPOINT || process.env.GAS_WEBAPP_URL;
const PORT = process.env.PORT || 3000;

if (!OPENAI_KEY) {
  console.error('❌ OPENAI_API_KEY が .env に設定されていません。');
  process.exit(1);
}
if (!GAS_ENDPOINT) {
  console.error('❌ GAS_ENDPOINT または GAS_WEBAPP_URL が .env に設定されていません。');
  process.exit(1);
}

// ==== OpenAI 初期化 ====
const client = new OpenAI({ apiKey: OPENAI_KEY });

// ==== Function定義 ====
const functions = [
  {
    name: "addMemo",
    description: "Add a vocabulary memo to the Google Sheet",
    parameters: {
      type: "object",
      properties: {
        word: { type: "string", description: "The vocabulary word (required)" },
        meaning: { type: "string", description: "The meaning (required)" },
        example: { type: "string", description: "Example sentence (optional)" },
        memo: { type: "string", description: "Extra note (optional)" }
      },
      required: ["word", "meaning"]
    }
  },
  {
    name: "getMemos",
    description: "Get memo list from the Google Sheet",
    parameters: {
      type: "object",
      properties: {}
    }
  }
];

// ==== ChatGPTエンドポイント ====
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ error: 'message が必要です' });

    // ChatGPTへの問い合わせ
    const chatResp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: userMessage }],
      functions,
      function_call: 'auto',
      temperature: 0.2
    });

    const msg = chatResp.choices[0].message;

    // 関数呼び出しの処理
    if (msg.function_call) {
      const fname = msg.function_call.name;
      const fargs = msg.function_call.arguments ? JSON.parse(msg.function_call.arguments) : {};

      // ---- addMemo ----
      if (fname === 'addMemo') {
        const gasPayload = {
          action: 'addMemo',
          data: {
            word: fargs.word,
            meaning: fargs.meaning,
            example: fargs.example || "",
            memo: fargs.memo || ""
          }
        };
        const gasResp = await axios.post(GAS_ENDPOINT, gasPayload, { headers: { 'Content-Type': 'application/json' } });
        return res.json({ source: 'GAS', result: gasResp.data });
      }

      // ---- getMemos ----
      else if (fname === 'getMemos') {
        const gasPayload = { action: 'getMemos' };
        const gasResp = await axios.post(GAS_ENDPOINT, gasPayload, { headers: { 'Content-Type': 'application/json' } });
        return res.json({ source: 'GAS', result: gasResp.data });
      }

      else {
        return res.status(400).json({ error: '未対応の関数です' });
      }
    }

    return res.json({ source: 'ChatGPT', content: msg.content });

  } catch (err) {
    console.error(err?.response?.data || err.message || err);
    return res.status(500).json({ error: (err?.response?.data || err.message || String(err)) });
  }
});

// ==== Function直呼び用API ====
app.post("/function/addWord", async (req, res) => {
  const { word, meaning, example, memo } = req.body;

  if (!word || !meaning) {
    return res.status(400).json({ error: "word and meaning are required" });
  }

  try {
    const gasResponse = await fetch(GAS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addMemo",
        data: { word, meaning, example, memo }
      })
    });

    const result = await gasResponse.json();
    res.json({ source: "GAS", result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to call GAS Web App" });
  }
});

// ---- GET: getMemos ----
const gasUrl = process.env.GAS_ENDPOINT;

app.get("/function/getMemos", async (req, res) => {
  try {
    const gasResponse = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getMemos" })
    });

    const result = await gasResponse.json();
    res.json({ source: "GAS", result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to call GAS Web App for getMemos" });
  }
});



// ==== 起動 ====
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// openapi.jsonを返す処理（Render対応版）
const fs = require("fs");
const path = require("path");

app.get("/openapi.json", (req, res) => {
  // Render の実行ディレクトリ確認
  const basePath = process.cwd();
  const filePath = path.join(basePath, "openapi.json");

  console.log("📂 Current working dir:", basePath);
  console.log("📄 Looking for openapi.json at:", filePath);

  if (!fs.existsSync(filePath)) {
    console.error("❌ openapi.json not found at:", filePath);
    return res.status(404).send("openapi.json not found");
  }

  res.setHeader("Content-Type", "application/json");
  res.sendFile(filePath);
});



