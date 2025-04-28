const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
require('dotenv').config();

const app = express();

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

  const echo = { type: 'text', text: `受け取ったよ: ${event.message.text}` };

  return client.replyMessage(event.replyToken, echo);
}

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
