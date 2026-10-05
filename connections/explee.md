# explee (all-in-one outbound)

Step 4 of the guide. Needed in setup 2.

## What the key is for

In setup 2 you set the ICP and approve the sequence inside your explee account. The step "Build the list and launch outreach" happens there. The AI agent does only one job through this key: it reads every reply and answers in the same thread, from explee's mailbox.

The guide does not use explee's own AI replies, so that all three setups run on one AI agent that answers from your rules and product knowledge, checks the CRM before each email and hands unsure replies to a person. Keep explee's own AI replies switched off.

Variable: `EXPLEE_API_KEY`

## Where to create it

In your explee account settings, in the section for API access. Check the vendor docs for the current name of the section; explee is a young product and its settings move.

## Minimum scope

If explee lets you limit the key, allow reading replies and sending replies, and nothing else. If it does not, use the key only for those two jobs, and never to change the campaign or the billing.

## Calls the AI agent makes

This file gives no ready curl examples on purpose. explee's public API paths and field names were not confirmed when this template was written, and a made-up path is worse than none. Read the vendor docs, then write the confirmed calls here in the same shape as the other files in this folder.

The AI agent needs three calls. Describe them to Claude Code from the docs:

1. A read-only call that proves the key works. The `first-run-setup` skill uses it. For example, list your campaigns.
2. Read the replies: every reply in every campaign, including finished ones, with the lead's address, the thread and the date. The daily check uses this call too.
3. Reply in a thread: send an answer in the same thread from explee's mailbox.

The shape of a call, once you have the paths, looks like this. Replace the parts in angle brackets with what the docs say:

```bash
curl -s "<base URL from the vendor docs>/<path to list replies>" \
  -H "<auth header from the vendor docs>: $EXPLEE_API_KEY"
```

## The adapter the daily check uses

The daily check reads explee's replies through `scripts/lib/adapters/explee.mjs`. That file ships with two empty places, `BASE` and `REPLIES_PATH`, and a `toReply()` function that maps explee's fields to the shared reply shape. Fill them in from the vendor docs when you write the calls above. Until you do, a live daily check in setup 2 stops with exit code 3 ("could not run") and raises an alarm. That is on purpose: it never passes silently.

## Notes

- Before you move to setup 1, export your leads and your sequences from explee. They become yours: the mailboxes, lists and sequences move to Apollo, Smartlead and your own mailboxes.
- A missed reply here is the same failure as in Smartlead. The daily check reads explee's inbox every day.
