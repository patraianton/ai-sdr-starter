# Approval and people

Step 1 of the guide, rule file 8 of 8. Northstar Dispatch. The four names are in settings.yml. This file says what each person does.

## Approval stage
- Stage 1 since 2026-03-02. Every email waits on the card (label Draft ready) until Sam approves it. Nothing leaves without his approval comment.
- Move to stage 2 when drafts have gone out unchanged for five working days in a row. Priya Natarajan makes the move by editing approval.stage in settings.yml.

## Who approves
- Approver: Sam Okafor, GitHub login `sokafor-ns`. When Sam is away, Priya Natarajan approves with her own login, `priya-ns`. The logins live only in this file, not in settings.yml.

### How an approval looks on the card
- An approval is a comment from `sokafor-ns` that reads exactly `approved`: the AI agent sends the draft as written.
- `approved, with changes:` followed by text sends that text.
- Anything else from Sam is a question or a change: the AI agent redrafts and the draft waits again.
- A comment from any other login, and any comment from the AI agent's own GitHub App, never counts as an approval.

## The waiting list for stage 2
- A lead who names a time for a call, or asks for a discount or a custom contract.
- A partnership or reseller offer, and any complaint.
- A company above 200 technicians, a reply that holds only an attachment, and any question knowledge/ does not answer.

## Who answers the waiting list
- Sam answers the waiting list. His answer goes into knowledge/ the same day, so it is asked once.
- A reply that waits for Sam more than one working day raises an alarm in the daily check that names him.

## Who hosts the call
- Dana Reyes hosts every call. She blocks the days she is away in Calendly, so no slot is booked without a host.
- A reply that waits for Dana more than one working day raises an alarm that names her.

## Who puts the switch back
- Priya Natarajan holds the stop switch and puts the file SENDING_ON back.
- Before she does, Sam or Priya reads every draft that waited.

## Stage 3 and the flagged cards
- Northstar is not at stage 3. When it is, Sam reads the flagged cards every morning, and a lesson from a flagged card becomes one line in the rule file that should have caught it.
