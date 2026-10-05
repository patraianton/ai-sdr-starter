# What to check before writing

Step 1 of the guide, rule file 2 of 8. Northstar Dispatch. Run these checks before the first reply and again before every follow-up. Match by company domain, never by the exact address.

## Is the company already a customer
- Search HubSpot by domain. A closed-won deal means a customer: send no sales email, label the card No fit with the reason "customer", close it, and write a handover note for Sam if the reply is a support question.

## Is someone on our team already talking to it
- Look back 90 days. Any open deal in HubSpot, any email from Dana or Sam to the domain, any booking on Dana's calendar, or a person's note on the card means: label the card "Our person is in the thread" and send nothing.
- Example: Denise at gulfcoastcooling.example writes in, and Dana emailed her owner at the same domain on 2026-03-06. Same domain, so stop.
- In setup 3 the AI agent writes from Dana's mailbox. Its own emails do not count as Dana talking. The card log shows who sent each email.
- Three kinds of note are not "our person talking": Sam's `approved` comment on a draft, Dana's note about a call after a booking is on the card, and a person's answer to a handover note addressed to that person.

## Has the lead booked
- Search Calendly bookings by email, by domain and by company name. A booking means: label Booked, stop follow-ups, send nothing new.

## Match by company domain
- Reply from ann@company.example, booking from bob@company.example: same domain, same company, same card.
- Free-mail domains such as gmail.com are not company domains. For those, match by exact address and by name.

## Look the company up
- Look the company up in Apollo and write size, industry and country on the card as a found-out note. Size means technicians if their site says so, otherwise employees. Write which.
- If the lead is not in HubSpot yet, create it now and put the link in the card header. Do this before the AI agent's first email.
- Outside the US and Canada: label the card No fit and send nothing.

## Test accounts (setup 3)
- Setup 3 only. A sign-up from one of our own domains, or with the company name "test", is one of our test accounts. Drop it and write nothing on a card.
- Our own domain: northstardispatch.example. Any other of our domains goes into SIGNUP_OWN_DOMAINS in .env.
- Addresses that are ours but not on our own domain. The sign-up script drops each one without a card:
  - `sam.sandbox@northstar-labs.example` (the sandbox account Sam uses for demos)
  - `priya.trial@northstar-labs.example` (Priya's own trial account)
  - `dana.demo@northstar-labs.example` (the account Dana shares screens from on calls)
