# Calendly (the sales rep's calendar)

Step 4 of the guide. Needed in every setup.

## What the key is for

- The AI agent puts the sales rep's booking link in the reply, once the lead's qualification answers are on the card.
- On every run it reads the new bookings and matches them to cards by email, company domain or name. A match sets the label "Booked" and stops the follow-ups.
- The daily check reads the same calendar after each meeting to decide whether the call was held or was a no-show.

The booking link itself is `email.booking_link` in `rules/settings.yml`. It is a public address, not a secret.

Variable: `CALENDLY_TOKEN`

## Where to create it

In Calendly: Integrations, API and Webhooks, create a personal access token. A personal access token works on any plan, the free one included. The AI agent needs no webhooks, because it checks bookings on every run, and webhooks are a paid feature.

## Minimum scope

A personal access token has the access of the person who made it, and Calendly does not narrow it. Create it under the sales rep's account, the one whose calendar the booking link belongs to, and use it only to read events. The AI agent never changes or cancels a booking.

## Calls the AI agent makes

Base URL: `https://api.calendly.com`. The token goes in the header `Authorization: Bearer`.

1. Read who the token belongs to. Read-only. The `first-run-setup` skill uses it to test the token. The answer holds the user address you need for the next calls.

```bash
curl -s "https://api.calendly.com/users/me" \
  -H "Authorization: Bearer $CALENDLY_TOKEN"
```

2. List the scheduled events of that user from a date on. Used on every run.

```bash
curl -s -G "https://api.calendly.com/scheduled_events" \
  -H "Authorization: Bearer $CALENDLY_TOKEN" \
  --data-urlencode "user=$CALENDLY_USER_URI" \
  --data-urlencode "min_start_time=2026-03-01T00:00:00Z" \
  --data-urlencode "status=active" \
  --data-urlencode "sort=start_time:asc" \
  --data-urlencode "count=100"
```

Each event has `uri`, `start_time`, `created_at` and `status`. Use `created_at` to keep only bookings created after the AI agent's first email to that company. Page through the results with the `next_page` link in the response.

3. List who booked an event. Used to match the booking to a card by email, domain or name.

```bash
curl -s "https://api.calendly.com/scheduled_events/$EVENT_UUID/invitees" \
  -H "Authorization: Bearer $CALENDLY_TOKEN"
```

An invitee has `name`, `email`, `created_at` and the answers to your booking form questions.

## Notes

- Matching: first by the invitee's email, then by the domain of the email, then by the name. The invitee is often a colleague of the lead who wrote. Free-mail addresses never match by domain.
- A booking with no card is not an error. It is a booking the AI agent did not cause. It is not in the report's first line, which counts only bookings created after the AI agent's first email to that company.
- A call counts as held only when the calendar or a recording confirms it. After the meeting time the daily check reads the event again. No recording and no note on the card means a no-show in the report.
