const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
require('dotenv').config();
const axios = require('axios');

// Firebase Admin 初期化
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(express.json());

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new Client(config);

// 🔸 OpenAIに問い合わせる関数
async function askGPT(systemPrompt, userText) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  );

  return res.data.choices[0].message.content;
}

// 🔸 イベント処理本体
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;
  const userId = event.source.userId;

  // プロンプト取得
  const promptDoc = await db.collection('prompts').doc('systemPrompt').get();
  const systemPrompt = promptDoc.exists ? promptDoc.data().content : 'あなたはやさしく寄り添う育児サポートAIです。';

  // GPTから返信取得
  const reply = await askGPT(systemPrompt, userMessage);

  // LINEに返信
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: reply
  });

  // Firestoreに保存
  await db.collection('logs').add({
    userId,
    text: userMessage,
    reply,
    timestamp: Date.now()
  });
}

// webhookエンドポイント
app.post('/webhook', middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error('Webhook error:', err);
      res.status(500).end();
    });
});

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
