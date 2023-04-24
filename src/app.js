import axios from 'axios';
import dotenv from 'dotenv';
import bolt from '@slack/bolt';

dotenv.config();
const { App } = bolt;
const env = process.env;

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: env.SLACK_APP_TOKEN,
  port: env.PORT || 3000
});

/**
 * サーバー起動
 */
(async () => {
  await app.start(process.env.PORT || 3000);
  console.info('[INFO] Bolt app is running!');
})();

const ACTIONS = {
  ask: {
    id: 'ask',
    label: '質問する',
  },
  summarize: {
    id: 'summarize',
    label: 'スレッド要約',
  },
};

/**
 * メンションイベントを受け付け
 */
app.event('app_mention', async ({event, client, say}) => {
  const threadTs = event.thread_ts || event.ts;

  // INFO: リクエスト(event.text)にメンション以外の入力があれば質問として処理
  const textWithoutMemberId = event.text.replace(`<@${env.SLACK_BOT_MEMBER_ID}>`, '');
  if (textWithoutMemberId.length > 0) {
    try {
      // INFO: 該当スレッドの会話取得
      const replies = await client.conversations.replies({
        channel: event.channel,
        ts: threadTs,
      });

      if (!replies.messages) {
        await say({
          thread_ts: threadTs,
          text: '[ERROR]:\nスレッドが見つかりませんでした。\n管理者に連絡してください。'
        });
        return;
      }

      const threadMessages = replies.messages.map((message) => {
        return {
          role: message.user === env.SLACK_BOT_MEMBER_ID ? 'assistant' : 'user',
          content: (message.text || '').replace(`<@${env.SLACK_BOT_MEMBER_ID}>`, '').replace(`<@${message.user}> `, ''),
        };
      });

      // INFO: OpenAI API呼び出し
      const response = await axios.post(
        env.OPENAI_API_URL,
        {
          model: env.OPENAI_API_MODEL,
          messages: threadMessages,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
        },
      );
      // TODO:fetchで試す
      // const response = await fetch(
      //   env.OPENAI_API_URL,
      //   {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      //     },
      //     body: {
      //       model: env.OPENAI_API_MODEL,
      //       messages: threadMessages,
      //     },
      //   },
      // );

      if (!response.data) {
        await say({
          thread_ts: threadTs,
          text: '[WARNING]:\n回答の取得に失敗しました。',
        });
        return;
      }

      await say({
        thread_ts: threadTs,
        text: response.data.choices[0].message.content,
      });
      return;
    } catch (error) {
      await say({
        thread_ts: threadTs,
        text: '[ERROR]:\nエラーが発生しました。\n管理者に連絡してください。'
      });
      return;
    }
  }

  const actionButtons = [
    {
      type: 'button',
      text: {
        type: 'plain_text',
        text: ACTIONS.ask.label,
      },
      action_id: ACTIONS.ask.id,
    },
  ];

  // INFO: スレッド内でメンションされた際は「要約」ボタンを追加
  if (event.parent_user_id) {
    actionButtons.push(
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: ACTIONS.summarize.label,
        },
        action_id: ACTIONS.summarize.id,
      },
    );
  }

  await say({
    // INFO: スレッド指定
    thread_ts: event.ts,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<@${user}> 用件を選択してください。`,
        },
      },
      {
        type: 'actions',
        elements: actionButtons,
      },
    ],
    text: `<@${user}> 用件を選択してください。`,
  });
});

/**
 * 「質問」ボタンクリック時処理
 */
app.action(ACTIONS.ask.id, async ({body, ack, say}) => {
  // INFO: Slack からリクエストを受信したことをack()で確認。
  await ack();
  await say({
    thread_ts: body.container.thread_ts,
    text: '質問どうぞ（※必ずメンションを含めて下さい）',
  });
});

/**
 * 「要約」ボタンクリック時処理
 */
app.action(ACTIONS.summarize.id, async ({body, client, ack, say}) => {
  await ack();

  const channelId = body.channel.id;
  const threadTs = body.container.thread_ts;
  try {
    const replies = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
    });

    if (!replies.messages) {
      await say('[ERROR]:\nスレッドが見つかりませんでした。\n管理者に連絡してください。');
      return;
    }

    const threadMessages = replies.messages.map((message) => {
      return {
        role: message.user === env.SLACK_BOT_MEMBER_ID ? 'assistant' : 'user',
        content: (message.text || '').replace(`<@${env.SLACK_BOT_MEMBER_ID}>`, '').replace(`<@${message.user}> `, ''),
      };
    });
    threadMessages.push({
      role: 'user',
      content: 'このスレッドの内容を要約してください。',
    });

    // INFO: OpenAI API呼び出し
    const response = await axios.post(
      env.OPENAI_API_URL,
      {
        model: env.OPENAI_API_MODEL,
        messages: threadMessages,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
      },
    );

    if (!response.data) {
      await say({
        thread_ts: threadTs,
        text: '[WARNING]:\n回答の取得に失敗しました。',
      });
      return;
    }

    await say({
      thread_ts: threadTs,
      text: response.data.choices[0].message.content,
    });
    return;
  } catch (error) {
    await say({
      thread_ts: threadTs,
      text: '[ERROR]:\nエラーが発生しました。\n管理者に連絡してください。'
    });
    return;
  }
});
