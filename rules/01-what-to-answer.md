# What to answer and what to skip

Step 1 of the guide, rule file 1 of 8. Setup: every setup.

This file tells the AI agent which replies get an answer, which get none, and which wait for a date. Write each line as an example of a lead's message and the action you expect.

## Read the whole thread

The AI agent reads the whole thread, not the last message. A short "ok, thanks" can be the end of a long exchange or the start of a yes. Say how you want the thread read before it replies.

<!-- example: A lead writes "ok, do that" with a long thread above it. Read the thread first, find what "that" is, and answer that. -->

-

## Answer these

The AI agent answers questions, objections, positive replies and facts the lead gives about their own setup. List the kinds of reply your SDR answers, each with a message and the action.

<!-- example: A lead asks "does it work with our accounting system?" Answer from knowledge/have-and-do-not-have.md and end with a next step. -->

-

## Skip these

The AI agent sends nothing to an autoresponder, an unsubscribe or a clear refusal. An autoresponder gets a `reply` note on the card, and the follow-up schedule runs on. An unsubscribe and a clear refusal both close the card with the label "No fit" and stop the lead's sequence.

<!-- example: An out-of-office reply that names a return date is an autoresponder. Skip it, note the date on the card, and let the follow-up schedule run. "Remove me from your list" is an unsubscribe: label the card "No fit", close it, and stop the sequence. -->

-

## Park these

"Not now" is not a refusal. The AI agent parks the lead with a date, sets the label "Parked", and comes back on that date. A "not now" with no date gets a short question for a date, once.

<!-- example: "Call me after the summer" parks the lead until 1 September. Write the date on the card and send nothing until then. -->

-
