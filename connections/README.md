# Connections

Step 4 of the guide: what the AI agent needs access to.

A connection is an API key, or service token. You create it in the service's settings and paste it on one line of the settings file where the AI agent runs: copy `.env.example` to `.env` next to `CLAUDE.md`, on your computer or on the server. You or your SDR can do this. A developer is needed once for the setup 3 mailbox and, if your product or form service has neither a webhook (your product calls an address you give it each time something happens) nor a notification email, for the sign-up feed. The board's GitHub App comes from step 2. [github-app.md](github-app.md) shows how to create it and how to check it with `node scripts/gh-app-token.mjs --check`.

## The connections

Each row is one key. Each links to a file that says what the key is for, where to create it, the smallest access it needs and the calls the AI agent makes.

| Connection | What the AI agent does through it | Needed in |
|---|---|---|
| The board, a GitHub App, [github-app.md](github-app.md) | The AI agent creates and updates the cards, sets the labels and writes the notes, as its own identity. It can read and write issues on this one repository and nothing else. | every setup |
| Contact data, Apollo, [apollo.md](apollo.md) | In setup 1 the AI agent builds the list to your ICP (ideal customer profile); in every setup it looks up the size, industry and country of each company that replies or signs up. | every setup |
| Email verification, ZeroBounce, [zerobounce.md](zerobounce.md) | The AI agent checks every address before the send. | setup 1 |
| Sending service, Smartlead, [smartlead.md](smartlead.md) | The AI agent loads the verified list and sequence, reads every reply, answers in the same thread and sends the follow-ups. | setup 1 |
| All-in-one outbound, explee, [explee.md](explee.md) | The AI agent reads every reply and answers in the same thread from explee's mailbox. | setup 2 |
| A mailbox for sign-ups, [mailbox.md](mailbox.md) | The AI agent writes from the sales rep's or a shared company address on Google Workspace or Microsoft 365. A developer connects it once through the provider's API or Unipile, a connector for Gmail and Outlook accounts. | setup 3 |
| Your CRM, such as HubSpot or Pipedrive, [crm.md](crm.md) | The AI agent checks whether the company is a customer or in an active deal, then creates the lead before the first email for the sales rep to see. | every setup |
| The sales rep's calendar, Calendly, [calendly.md](calendly.md) | The AI agent puts the booking link in the reply and, on every run, reads new bookings and matches them to cards by email, company domain or name. | every setup |
| Sign-ups and forms, [signups.md](signups.md) | The AI agent receives each sign-up through the webhook or notification email from the setups section of the guide. | setup 3 |
| Short links, Short.io, [shortio.md](shortio.md) | The AI agent creates one link per lead to the requested material and, on every run, reads whether it was opened and when. | every setup |
| Slack, [slack.md](slack.md) | You install a Slack app with a bot token in your workspace, and the AI agent posts through it: the cards to one channel, the alarms from the daily check to another and, in team mode, the drafts for approval. | team mode and alarms |

Apollo's API comes with every paid plan; Smartlead's needs the Pro plan. A Calendly personal access token works on any plan, the free one included, and the AI agent needs no paid webhooks because it checks bookings on every run. Short.io's free plan includes the API and click statistics; put the links on your own short domain so they look like yours.

The variable names for all keys are in `.env.example`, one line per key, each with a note on which setup needs it.

## Two rules for keys

1. Keep keys in the settings file where the AI agent runs, never in the repository, on a card or in chat. The AI agent reads a key when needed and never writes its value to a log or card. Whoever has the file can access every connected service, so reissue the keys when a person with access leaves. The file `.env` is in `.gitignore`; check that before your first commit.
2. Limit each key to the job in its row: the Slack app posts to two channels and reads nothing, the calendar token reads bookings, and the GitHub App opens only the repository from step 2. A leaked key exposes one service, not the company.

## About the curl examples

Every file in this folder has a few `curl` calls the AI agent uses. They show the real shape of each service's public API as it was when this template was written. Services change their APIs. Where a file says "check the vendor docs", the call is described in words on purpose and the exact path is for you or the AI agent to confirm in the vendor's documentation before the first run.

Run the read-only calls yourself once, with your own key, before the first run of the AI agent. The `first-run-setup` skill does the same check for every key.

Each example reads its key from an environment variable, never from a typed value. Do not paste a key into a command in a shared terminal, and do not save the output of a call that returns a key.
