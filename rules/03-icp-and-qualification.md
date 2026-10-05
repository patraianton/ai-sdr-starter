# Who fits and what to ask

Step 1 of the guide, rule file 3 of 8. Setup: every setup.

This file defines the ICP, the ideal customer profile, and the questions the AI agent must get answered before it sends the booking link. The size floor is a number, so it lives in [`settings.yml`](settings.yml) as `icp.size_floor`. Everything else is here.

## Industry

List the industries you sell to, one per line. Anything not on the list gets a short check with a person before the AI agent invests in it.

<!-- example: HVAC, plumbing, electrical, appliance repair. -->

-

## Country

List the countries you sell to. A lead from any other country gets the label "No fit".

<!-- example: United States and Canada. -->

-

## Size floor

Say what counts as size: employees, technicians, locations. A company below the floor in `settings.yml` closes as "No fit". Say what the AI agent writes to a lead that is below the floor, if it writes anything.

<!-- example: Size is the number of technicians. Below the floor, thank the lead once, close the card as "No fit", and do not offer a call. -->

-

## What must already be in place

Name what the lead must already have for your product to work, such as a CRM or an accounting system.

<!-- example: The company already uses a CRM or an accounting system. Ask if Apollo and the website do not show it. -->

-

## Hard disqualifiers

Name the companies that never fit, whatever their size. They get the label "No fit".

<!-- example: One-person operators, companies that resell software, companies outside the countries above, competitors. -->

-

## Questions to get answered

Write three or four questions the AI agent must get answered before it sends the booking link: fit, a real task, and the person who decides. "Call me" or "send it over" is not a qualified lead. The AI agent answers briefly, asks what is still open, and only then gives the link. The answers go on the lead's card, so the sales rep opens the call with them.

<!-- example: 1. How many people schedule jobs today, and with what tool? 2. What is the one thing you want fixed? 3. Who signs off on a purchase like this? -->

-
