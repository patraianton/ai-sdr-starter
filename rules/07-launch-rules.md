# Launch rules

Step 1 of the guide, rule file 7 of 8. Setup 1 only: skip this file if you do not run your own outbound.

This file holds what the AI agent needs before the first outbound send: the filters that find the right companies, the lists of people it must never email, and the limits on volume. The numbers are lines in [`settings.yml`](settings.yml) under `launch:`. The filters and the lists are written here.

## Who pays

Anchor the ICP on who pays, not on who replies. Enrich your paying customers by size, industry, country and CRM. The segments where the revenue sits are your ICP. Small companies reply readily and rarely pay. Write what you found, then copy the result into [`03-icp-and-qualification.md`](03-icp-and-qualification.md).

<!-- example: Of 120 paying customers, 80 have 20 to 200 employees, 70 are in two industries, and 90 use the same kind of CRM. -->

-

## Apollo filters

Write the Apollo filters that express the ICP: job titles, industries, company size, countries, and anything Apollo can filter on. The AI agent builds the list from these lines.

<!-- example: Titles: owner, operations manager, dispatch manager. Industries: as in 03. Employees: 15 to 300. Countries: as in 03. -->

-

## Suppression lists

Before the first send, load three lists into the sending service: your customers, everyone your team has ever written to, and everyone who said no. Say where each list comes from and who refreshes it.

<!-- example: Customers: CRM export of all closed-won domains. Team contacts: export from the sales rep's mailbox. Said no: unsubscribes and refusals from the last two years. -->

-

## Volume

Set how many new contacts go in per week (`launch.new_contacts_per_week`) and how many emails each mailbox sends per day (`launch.emails_per_mailbox_per_day`). Start low. A new mailbox sends a few emails a day, not hundreds.

<!-- example: Start at 100 new contacts a week and 20 emails per mailbox per day. Raise after two clean weeks. -->

-

## The bounce rate that pauses the campaign

Set the bounce rate at which the AI agent pauses the campaign and tells you (`launch.pause_at_bounce_rate`). Say who is told, and who decides when the campaign restarts.

<!-- example: At 3 percent bounces, pause the campaign, post to the alarms channel, and wait for the owner. -->

-
