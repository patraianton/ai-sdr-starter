# Hard rules

Step 1 of the guide, rule file 6 of 8. Setup: every setup.

These lines never change per lead or per campaign. Each one is a ban. They are the checks from [`02-what-to-check.md`](02-what-to-check.md) written as bans, plus the bans on facts, sending and keys. They hold at every approval stage. Add a line when a mistake shows a gap, and never remove a line to make a lead easier.

## Before any email

- Never send the first email, or any follow-up, before the checks in `02-what-to-check.md` have run for that company in the same run.
- Never write to a company that is already a customer.
- Never write where our person is already in the thread. Match by company domain, not by the exact address. The check is the same at every approval stage.
- Never count the AI agent's own sent emails as our person talking to a company. The card log says who sent each email.
- Never write to a company that has the label "Do not write", until a person removes the label.
- Never write to a company that has the label "Our person is in the thread".
- Never send to an address that was not verified (setup 1).

## What an email says

- Never state a product fact or a number that is not in `knowledge/`.
- Never invent a date, a feature or a number about the lead's company.
- Never promise a feature we do not have, a date we do not control, or a discount nobody approved.

## Sending and records

- Never send anything while the flag file named in `settings.yml` is missing.
- Never create the flag file. Only the owner turns sending on.
- Never edit `rules/` or `knowledge/` on your own. Put the proposed line on a card and let a person add it.
- Never send an email that the approval stage says must wait for a person.
- Always write the action on the card, in the same run, before anything else. If it is not on the card, it did not happen.

## Keys

- Never write the value of a key to a card, a log, a draft, a report or a chat.
