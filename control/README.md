# Control

Step 5 of the guide: who approves each email, how you stop all sending, and the rule that protects active deals.

Your approval stage is one line in [`../rules/settings.yml`](../rules/settings.yml) (`approval.stage`), with the names of the people in [`../rules/08-approval-and-people.md`](../rules/08-approval-and-people.md). Moving up a stage, or moving back after a bad week, takes one edit. You do not reprogram the AI agent.

## Three stages of approval

| Stage | What you see | Move on when |
|---|---|---|
| 1. You approve every email | Every draft waits in the Claude Code window, on the card, or in Slack. You read it, correct it if needed, approve it, and the AI agent sends it. | For several days in a row, you approve every draft without changing it. |
| 2. Routine replies go out, unsure ones wait | The rules say which replies wait, and the AI agent sends everything else within minutes. A waiting draft has the label "Draft ready" and, in team mode, a Slack message. | The waiting drafts also go out unchanged, and your waiting list keeps getting shorter. |
| 3. No approvals | Every reply goes out. A risky reply gets the standard answer and a warning line on its card, and you read the flagged cards every day. | This stage stays. |

The waiting list for stage 2 is written in [`08-approval-and-people.md`](../rules/08-approval-and-people.md). It usually includes a lead who named a time for a call, a price negotiation and a partnership offer. Add complaints, companies above a size you set, and replies that contain only an attachment. Any question the product knowledge does not answer also waits for you.

Stages 2 and 3 exist for speed. A draft can wait for hours while its approver is in a meeting, on holiday, or not reading the queue, and the warm lead cools. If drafts wait more than a day, the approver is the bottleneck, not the AI agent, so move to stage 2. At stage 3, anything you would have changed becomes a line in the rules, and the AI agent does not resend the email.

To change the stage, edit `approval.stage` in `settings.yml` and the stage line in `08-approval-and-people.md`. The next run uses the new stage.

## The stop switch

One flag file stops everything. Its name is the `sending_flag_file` line in `settings.yml`, and by default it is `SENDING_ON`. It sits in the folder where the AI agent runs, next to `CLAUDE.md`. While the file exists, sending is on.

| You do | What happens |
|---|---|
| Delete the file | No email leaves. The AI agent still reads replies, researches companies, writes drafts and updates the cards. The drafts wait on the cards. |
| Put the file back | The waiting drafts go out on the next run. Read them first if sending was off for long. |

Rules for the switch:

- The owner holds the switch. The name is `approval.switch_owner` in `settings.yml`.
- Nothing in the rules folder can turn sending on. The AI agent never creates the file. Those rules may make sending stricter, but never looser.
- The file is in `.gitignore`. It lives on the machine where the AI agent runs, not in the repository.
- Test the switch before the first real email: delete the file, watch one run end with no email sent, and put the file back. This is a row in the [launch checklist](../docs/launch-checklist.md).

To turn sending on, the owner creates an empty file by hand:

```
touch SENDING_ON            # macOS, Linux, Git Bash
New-Item SENDING_ON         # Windows PowerShell
```

## The one rule you never loosen

The AI agent never writes where your person is already talking.

Before the first email and before every follow-up, the AI agent checks by company domain, not by the exact address, whether:

- anyone from that company has an active deal in the CRM,
- anyone from that company has appeared in the sales rep's mailbox in the last months,
- anyone from that company has a booking on the calendar,
- a colleague has left a note on the card.

Any hit adds the label "Our person is in the thread". No email goes out then or later.

The check must tell the AI agent's emails apart from your person's emails. When the AI agent sends from the sales rep's mailbox in setup 3, its own sent emails do not count as the sales rep talking to that company. The card log names the sender of each email, and the check reads it.

This rule stays in [`06-hard-rules.md`](../rules/06-hard-rules.md) at every approval stage, including stage 3. The first person who stops trusting the AI agent is the sales rep whose deal it stepped on.

## "Do not write" and the switch

The two controls differ in reach.

| | The label "Do not write" | The stop switch |
|---|---|---|
| Reach | One company | Everything |
| Set by | A person, on the card | The owner, by deleting the flag file |
| What stops | Every email to that company, in every run, until a person removes the label | Every email to every company |
| What continues | Everything else | Reading replies, research, drafts and card updates |
| To undo | Remove the label | Put the file back |

Use the label when one company must be left alone, for example a partner. Use the switch when something is wrong with the whole system. You can set the label from the GitHub app on your phone.
