# slack-chatgpt-bot-js
SlackとOpenAI APIを掛け合わせ、ユーザーのアクションに応じたレスポンスを返却するbotのサンプルです。  
Slackのチャネルで`@{bot登録時に設定したbot名}`宛に空メッセージを送信することで、スレッドの要約や自由入力によるAIへの質問が可能。

## Requirements
- Node: `>=18`

## 実行手順
1. リポジトリをクローン
2. `src`ディレクトリで`npm install`を実行し、パッケージをインストール
3. `.env.example`を`.env`というファイル名で同階層にコピー
4. `.env`に必要情報を記載  
   ※`PORT`と`OPENAI_API_MODEL`は必要に応じて変更
5. `npm start`を実行し、サーバーを起動

## memo
- [Bolt-js | Reference](https://slack.dev/bolt-js/ja-jp/reference)
- [SlackAPI | Docs](https://api.slack.com/docs)
