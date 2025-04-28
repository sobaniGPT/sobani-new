const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
require('dotenv').config();

const app = express();

// Firebase Admin 初期化
const admin = require('firebase-admin');

// ここを書き換え（環境変数から読み込む形）
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new Client(config);

// 署名検証ミドルウェア
app.post('/webhook', middleware(config), (req, res) => {
  const events = req.body.events;

  Promise.all(events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// イベント処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const text = event.message.text;
  const userId = event.source.userId;

  // Firestoreに保存
  await db.collection('logs').add({
    text: text,
    userId: userId,
    timestamp: Date.now()
  });

  const echo = { type: 'text', text: `受け取ったよ: ${text}` };
  return client.replyMessage(event.replyToken, echo);
}

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
