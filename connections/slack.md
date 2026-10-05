# Slack

Step 4 of the guide. Needed in team mode and for alarms.

## What the key is for

You install a Slack app with a bot token in your workspace, and the AI agent posts through it:

- the cards, to one channel (`SLACK_CHANNEL_CARDS`);
- the alarms from the daily check, to another (`SLACK_CHANNEL_ALARMS`);
- in team mode, the drafts for approval (`SLACK_CHANNEL_APPROVALS`).

Without Slack, in way B, alarms go to a file in `alarms/` that you see when you open the Claude Code window, and approvals happen in the window. The guide assumes a team that approves in Slack uses OpenClaw or Hermes Agent on a server to pass the drafts along; that is a developer's job and is covered in `engine/way-a-server/README.md`.

Variables: `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_CARDS`, `SLACK_CHANNEL_ALARMS`, `SLACK_CHANNEL_APPROVALS` (the channel ids, which start with `C`, not the channel names)

## Where to create it

1. Go to api.slack.com/apps and create a new app from scratch, in your workspace.
2. Under OAuth and Permissions, add the bot scope `chat:write`.
3. Install the app to the workspace and copy the Bot User OAuth Token. It starts with `xoxb-`.
4. In each of the channels, invite the app: type `/invite @your-app-name`.
5. Copy each channel's id: open the channel, then its details, and the id is at the bottom.

## Minimum scope

One scope: `chat:write`. The app posts to the channels it was invited to and reads nothing. Do not add `channels:history`, `chat:write.public`, or any user scope. A leaked token then lets someone post to two or three channels, nothing more.

## Calls the AI agent makes

Base URL: `https://slack.com/api`. The token goes in the header `Authorization: Bearer`.

1. Check the token. Read-only. The `first-run-setup` skill uses it to test the key.

```bash
curl -s -X POST "https://slack.com/api/auth.test" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"
```

2. Post an alarm to the alarms channel. The daily check does this for a missed reply.

```bash
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "'"$SLACK_CHANNEL_ALARMS"'",
    "text": "Missed reply: Harbor Plumbing Co. (harborplumbing.example). A reply from this domain has no note on any card."
  }'
```

3. Post a draft for approval, in team mode, as a thread that holds the card link and the draft.

```bash
curl -s -X POST "https://slack.com/api/chat.postMessage" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "'"$SLACK_CHANNEL_APPROVALS"'",
    "text": "Draft ready for Harbor Plumbing Co. Card: https://github.com/OWNER/REPO/issues/2"
  }'
```

The answer holds `ok`. When `ok` is `false`, the field `error` says why. The common ones are `not_in_channel` (invite the app) and `invalid_auth` (the token is wrong or was reissued).

## Notes

- Approval by reaction or button is not done through this key, because the app reads nothing. In team mode OpenClaw or Hermes Agent takes the approval and passes it on, or the approver approves on the card.
- Never post a key, a full mailbox export or a lead's private details beyond the company name, the domain and the card link.
