const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
require('dotenv').config();

const admin = require('firebase-admin');

// Firebase Admin 初期化
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(express.json()); // 必須！ないとreq.body読めない

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new Client(config);

// イベント処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const text = event.message.text;
  const userId = event.source.userId;

  // Firestoreにログ保存
  await db.collection('logs').add({
    text: text,
    userId: userId,
    timestamp: Date.now()
  });

  // Firestoreからプロンプト（systemPrompt）を取得
  const systemPromptDoc = await db.collection('prompts').doc('systemPrompt').get();
  const systemPromptContent = systemPromptDoc.exists ? systemPromptDoc.data().content : '';

  if (!systemPromptContent) {
    console.error('systemPromptが取得できませんでした');
  }

  // LINE返信（いまはシンプルにプロンプトを付加して返信）
  const replyMessage = {
    type: 'text',
    text: `【ツツマレ GPT】\n${systemPromptContent}\n\nあなたのメッセージ：${text}`
  };

  return client.replyMessage(event.replyToken, replyMessage);
}

// 署名検証ミドルウェア
app.post('/webhook', middleware(config), (req, res) => {
  const events = req.body.events;

  Promise.all(events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error('イベントハンドリングエラー:', err);
      res.status(500).end();
    });
});

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
