# Follow-ups and when to stop

Step 1 of the guide, rule file 5 of 8. Setup: every setup.

This file says when the AI agent keeps following up and when it stops. The numbers (how many emails in a row with no reply, how many days apart, sending days and hours, the daily cap) are lines in [`settings.yml`](settings.yml) under `email:`. Here you write the reasons.

## What does not stop follow-ups

A reply does not stop follow-ups on its own. A reply that is an autoresponder, or a question the AI agent has answered, leaves the sequence running unless a rule below says otherwise. Say which replies keep the sequence going.

<!-- example: An out-of-office reply does not stop the sequence. A question from the lead pauses it until the answer is sent, then it resumes. -->

-

## What stops them

A booking or a sign-up stops the sequence. So does an explicit no, a no-show, and your limit of emails in a row with no reply (`email.follow_ups` in `settings.yml`). The first email counts toward the limit, so 3 means the first email and 2 follow-ups, and 4 means the first email and 3 follow-ups. A colleague's message in the thread stops it for good, and so does the label "Do not write".

<!-- example: The lead books a call. Stop all follow-ups, set "Booked", and write a handover note for the sales rep. -->

-

## What each follow-up adds

Each follow-up adds something new. It is never "just checking in". Say what counts as something new in your business.

<!-- example: A follow-up adds one new fact: a case study for the lead's industry, a feature released since the last email, or one specific question. -->

-

## A lead who goes quiet

Say what happens after the last follow-up with no answer. The card should say where the lead stands, so nobody wonders.

<!-- example: After the last email with no answer, write one next-step note that the sequence ended, with "On: none". Keep the label. The card is not closed and not parked. -->

-
