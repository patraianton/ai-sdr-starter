# What to check before writing

Step 1 of the guide, rule file 2 of 8. Setup: every setup.

The AI agent runs these checks before the first reply, and again before every follow-up. The checks come first because a perfect email sent to a customer, or to a company your colleague is already talking to, does damage. Every check is also written as a ban in [`06-hard-rules.md`](06-hard-rules.md).

## Is the company already a customer

The AI agent looks the company up in the CRM by company domain. A customer gets no cold email and no sales answer. Say what happens instead: who it goes to and what the AI agent writes on the card.

<!-- example: The domain has a closed-won deal in the CRM. Send no email, write a note on the card, and hand the thread to the account owner. -->

-

## Is someone on our team already talking to it

Anyone on your side who types in the thread owns it. The AI agent never writes there again. It looks for an active deal in the CRM, for a message from your sales rep's mailbox in the last months, for a booking on the calendar, and for a colleague's note on the card. Say how many months back to look.

Any hit sets the label "Our person is in the thread". No email goes out then or later. The AI agent's own sent emails never count as your person talking; the card log shows who sent each one.

Three kinds of note on the card are not "our person talking": the approver's `approved` comment on a draft, the call host's note about a call after a booking is on the card, and a person's answer to a handover note that was addressed to that person. They answer the AI agent, not the lead.

<!-- example: The sales rep wrote to anyone at this domain in the last 6 months. Set the label "Our person is in the thread" and stop. -->

-

## Has the lead booked

The AI agent reads the calendar before every email. A booked lead gets no more follow-ups. The label becomes "Booked", and the sales rep takes over.

<!-- example: A booking exists for any person at this domain. Set "Booked", write a handover note, and send nothing. -->

-

## Match by company domain

The AI agent matches by company domain, not by the exact address. The colleague who books is often not the person who wrote. Free-mail domains such as gmail.com are not company domains, so for those it matches by exact address and by name.

<!-- example: The reply came from ann@company.example and the booking is from bob@company.example. Same domain, so it is the same company and the same card. -->

-

## Look the company up

After the checks pass, the AI agent looks the company up in Apollo: size, industry and country. It writes what it found on the card as a `found-out` note before it drafts anything.

<!-- example: Apollo shows 40 employees, HVAC, Canada. Write it on the card, then check the ICP in 03-icp-and-qualification.md. -->

-

## Test accounts (setup 3)

Setup 3 only. The people on your own team sign up to the product too, to test it or to demo it. Those sign-ups are not leads. List their addresses here, one per line, and the sign-up script drops them without writing a card. Names that start with test, qa, demo or dev are dropped without being listed. Your own company domains go in `SIGNUP_OWN_DOMAINS` in `.env`.

<!-- example: sam.sandbox@yourcompany.example, the sandbox account the SDR uses for demos. -->

-
