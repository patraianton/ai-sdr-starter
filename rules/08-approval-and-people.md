# Approval and people

Step 1 of the guide, rule file 8 of 8. Setup: every setup. This file holds the choices of step 5 (control) and step 6 (the people).

It says which approval stage you are on, which replies wait for a person at stage 2, and who is behind every step. The four names also sit in [`settings.yml`](settings.yml) under `approval:`, so the daily check can name the person in an alarm. Keep the two places the same: change a name here, and change it there. Moving up a stage, or back after a bad week, takes one edit. The stages are explained in [`../control/README.md`](../control/README.md).

## Approval stage

Write the stage you run today, in one line, and the date you set it. The number is `approval.stage` in `settings.yml`. Start at stage 1 in every setup. Say when you will move up.

<!-- example: Stage 1 since 2026-03-02. Move to stage 2 when drafts have gone out unchanged for five working days in a row. -->

-

## Who approves

The person who approves every email at stage 1, and who reads the waiting list at stage 2. One name, and that person's GitHub login. Write who covers when this person is away.

<!-- example: Approver: the SDR, GitHub login `sam-example`. When the SDR is away, the owner approves. -->

-

### How an approval looks on the card

An approval is a comment on the card from the approver's GitHub login. The comment is exactly the word `approved`, and the AI agent sends the draft as written. To change the text, the comment is `approved, with changes:` followed by the new text, and the AI agent sends that text. Anything else the approver writes is a question or a change request: the AI agent redrafts and the draft waits again. A comment from any other login, and any comment from the AI agent's own GitHub App, never counts as an approval. In the Claude Code window, the approver's answer in the window counts instead.

The login lives only in this file, not in `settings.yml`. The AI agent compares the commenter's login with the login written under "Who approves" above, so keep that line exact.

## The waiting list for stage 2

At stage 2, a reply on this list waits for a person with the label "Draft ready". Everything else goes out within minutes. The list usually holds a lead who named a time for a call, a price negotiation, and a partnership offer. Add complaints, companies above a size you set, and replies that contain only an attachment. Any question that `knowledge/` does not answer also waits.

<!-- example: Waits: a lead names a time for a call. A lead asks for a discount. A reply with only an attachment. A company above the size you set. -->

-

## Who answers the waiting list

The person who reads the waiting list and answers each reply on it. If a reply waits a working day with no answer, the daily check raises an alarm that names this person. Write the answer to a new question into `knowledge/`, so it is asked once.

<!-- example: Waiting-list answerer: the SDR. The answer to a new question goes into knowledge/faq.md the same day. -->

-

## Who hosts the call

The person who hosts each booked call. Name one host for every calendar the AI agent points to. A booked slot with no host is a failure the board will not show: the lead arrives, nobody is there, and the card reads "Booked".

<!-- example: Call host: the sales rep, for the calendar behind the booking link. -->

-

## Who puts the switch back

The owner holds the stop switch. Write who puts the flag file back after sending was turned off, and who reads the waiting drafts first if sending was off for long.

<!-- example: Switch owner: the owner. Before putting the file back, the owner or the approver reads every draft that waited. -->

-

## Stage 3 and the flagged cards

At stage 3, no reply waits. A risky reply gets the standard answer and a warning line on its card, and a person reads the flagged cards every day. If you would have changed a reply, do not resend it. Write the lesson as a line in the rule file that should have caught it.

<!-- example: Stage 3 reader of flagged cards: the SDR, every morning. -->

-
