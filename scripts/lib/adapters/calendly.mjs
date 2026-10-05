// scripts/lib/adapters/calendly.mjs
// Guide: Step 4 (the sales rep's calendar) and Step 6 (the report and the no-show check).
//
// Reads bookings from Calendly with a personal access token. The token works on any plan, the free one included.
// The AI agent needs no paid webhooks: it reads the bookings on every run.
//
// Calls used (Calendly API v2):
//   GET https://api.calendly.com/users/me
//   GET https://api.calendly.com/scheduled_events?user=...&min_start_time=...&max_start_time=...&status=active&count=100
//   GET {event uri}/invitees
// Header on every call: Authorization: Bearer <token>.
//
// DRY_RUN=1 returns the bookings from scripts/fixtures/bookings.json.
// Every booking comes back in one shape:
//   { id, invitee_email, invitee_name, event_name, start_time, end_time, created_at, host_email, host_name }

import { fetchJson, isDryRun } from '../http.mjs';
import { loadFixture } from '../settings.mjs';

const BASE = 'https://api.calendly.com';
const DAY = 24 * 3600 * 1000;

function headers() {
  const token = (process.env.CALENDLY_TOKEN ?? '').trim();
  if (!token) throw new Error('CALENDLY_TOKEN is not set');
  return { Authorization: `Bearer ${token}` };
}

const call = (url) => fetchJson(url, { vendor: 'Calendly', headers: headers() });

// Active bookings created at or after `since` (a Date). `until` (a Date) limits how far ahead a meeting may start.
export async function listBookings({ since, until = new Date(Date.now() + 60 * DAY) }) {
  if (isDryRun()) {
    return loadFixture('bookings.json')
      .bookings.filter((booking) => new Date(booking.created_at) >= since)
      .map((booking) => ({ ...booking }));
  }
  const me = await call(`${BASE}/users/me`);
  const userUri = me?.resource?.uri;
  if (!userUri) throw new Error('Calendly did not return the user for this token');

  // The calendar filters by meeting start, not by when the booking was made, so look back a little further.
  const query = new URLSearchParams({
    user: userUri,
    status: 'active',
    count: '100',
    min_start_time: new Date(since.getTime() - 45 * DAY).toISOString(),
    max_start_time: until.toISOString(),
    sort: 'start_time:asc',
  });
  const bookings = [];
  let next = `${BASE}/scheduled_events?${query}`;
  while (next) {
    const page = await call(next);
    for (const event of page?.collection ?? []) {
      if (new Date(event.created_at) < since) continue;
      const host = event.event_memberships?.[0] ?? {};
      const invitees = await call(`${event.uri}/invitees`);
      for (const invitee of invitees?.collection ?? []) {
        bookings.push({
          id: `${event.uri.split('/').pop()}:${invitee.email}`,
          invitee_email: invitee.email,
          invitee_name: invitee.name ?? '',
          event_name: event.name ?? '',
          start_time: event.start_time,
          end_time: event.end_time,
          created_at: invitee.created_at ?? event.created_at,
          host_email: host.user_email ?? '',
          host_name: host.user_name ?? '',
        });
      }
    }
    next = page?.pagination?.next_page ?? null;
  }
  return bookings;
}
