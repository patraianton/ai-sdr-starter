# Sign-ups and forms

Step 4 of the guide. Needed in setup 3.

## What this connection is for

In setup 3, leads come in on their own: trial sign-ups, website forms, partner directories. The AI agent receives each one through a webhook or a notification email from your product or form service, checks the company against your ICP and starts the conversation. If your product or form service has neither a webhook nor a notification email, a developer adds one once.

This is not an API key to a vendor. It is a feed you own, and two secrets that protect it.

Variables: `SIGNUP_WEBHOOK_SECRET` (the shared secret that signs webhook calls), `SIGNUP_NOTIFICATION_MAILBOX` (the mailbox address that receives the notification emails), `SIGNUP_OWN_DOMAINS` (your own company domains, separated by commas; sign-ups from them are test accounts)

## The two ways in

| Way in | How it works | When to use it |
|---|---|---|
| Webhook | A webhook means your product calls an address you give it each time something happens. Here, on every sign-up, it sends the sign-up data (a POST call) to an address your developer set up. The call is signed with `SIGNUP_WEBHOOK_SECRET`. A small receiver checks the signature and appends the sign-up as one JSON line to `runs/signups-inbox.jsonl`, which is where the scripts read it. | Your product or form service can call a webhook. |
| Notification email | Your product sends an email to `SIGNUP_NOTIFICATION_MAILBOX` on every sign-up. The AI agent reads the mailbox, as in `mailbox.md`, and takes the fields from the email. | The service can only send an email. |

Pick one. The `signup-flow.mjs` script in `engine/way-c-scripts/` reads the feed through the sign-ups adapter, and in `DRY_RUN` it reads `scripts/fixtures/signups.json`.

## Where to create it

- Webhook: in your product's or form service's settings, add a webhook for new sign-ups or new submissions, and set its address and its secret. The address is the receiver your developer runs. Choose a long random value for `SIGNUP_WEBHOOK_SECRET`, for example from `openssl rand -hex 32`.
- Notification email: in the same settings, add the notification address. Use a mailbox that only gets sign-ups. Do not use a personal inbox.

## Minimum scope

The feed carries only what the AI agent needs: the person's name and email, the company name or domain, the date and where the sign-up came from. Do not send passwords, payment details or the contents of the account.

## Calls the AI agent makes

The sign-up feed is input, so the AI agent makes no outgoing call here. These are the two calls you use to test it.

1. Send a test sign-up to your receiver, signed with the secret. The exact header name and signing method belong to your product or form service; this shows the usual shape, a signature over the body with HMAC-SHA256, a code made from the message and the shared secret, so the receiver can tell the call really came from your product. Check your service's docs and use its method.

```bash
BODY='{"email":"casey@blueridgehvac.example","name":"Casey Moore","company":"Blue Ridge HVAC","created_at":"2026-03-02T14:05:00Z","source":"trial sign-up"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SIGNUP_WEBHOOK_SECRET" | sed 's/^.* //')
curl -s -X POST "https://your-receiver.example/signups" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

2. For the notification email way, send a test email to `SIGNUP_NOTIFICATION_MAILBOX` from your product's own settings, and read it with the mailbox call in `mailbox.md`. Check that the fields you need are in the email.

## What the scripts drop

Before anything else, the scripts remove every sign-up from a free-mail address and every test account of yours. The test accounts are the addresses listed under the heading "Test accounts (setup 3)" in `rules/02-what-to-check.md`, the names that start with test, qa, demo or dev, and every address on a domain in `SIGNUP_OWN_DOMAINS`. A dropped sign-up is written to the run log, not to a card.

## Notes

- The webhook receiver must reject any call whose signature does not match. Without that, anyone who finds the address can start the AI agent writing to a stranger.
- Sign-ups arrive in bursts and sometimes twice. The AI agent searches the cards by company domain before it creates one, so a duplicate becomes a note on the existing card.
