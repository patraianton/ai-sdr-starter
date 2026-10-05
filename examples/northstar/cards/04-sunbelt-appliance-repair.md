---
title: "Sunbelt Appliance Repair (sunbeltrepair.example)"
labels:
  - "Booked"
state: open
---

| Field | Value |
|---|---|
| Company | Sunbelt Appliance Repair |
| Domain | sunbeltrepair.example |
| Contacts | Rosa Delgado, rosa.delgado@sunbeltrepair.example, Operations Director<br>Mark Pierce, mark.pierce@sunbeltrepair.example, COO |
| Size | 120 technicians (Apollo and their site) |
| Industry | Appliance repair |
| Country | United States (Phoenix, AZ, and Tucson, AZ) |
| Source | Trial sign-up 2026-03-02 (webhook from the product) |
| CRM record | https://app.hubspot.com/contacts/10000001/company/20455 |
| Setup | 3 |

---

**2026-03-02 10:41 · AI agent · found-out**
Customer check (CRM, by domain): not a customer, no closed-won deal. No HubSpot record, so the lead was created before the first email (linked in the header)
Our person in the thread (CRM, mailbox, calendar, card): none found (none in the last 90 days, no person's note on this card)
Booking on the calendar: none
Company (Apollo): 140 employees, 120 technicians on their site, appliance repair, Phoenix, AZ, United States
Verdict: fits so far (120 technicians). Trial sign-up by webhook from rosa.delgado@sunbeltrepair.example: a business domain, not free-mail, not a test account. Accounting system, task and decision maker are not known yet, so the first email asks about size and task.

## Comments

### comment

**2026-03-02 11:30 · AI agent · draft**
To: rosa.delgado@sunbeltrepair.example
Subject: Your Northstar Dispatch trial
Waits for: Sam Okafor (stage 1)
Material: none

> Hi Rosa,
>
> I saw that Sunbelt Appliance Repair started a trial of Northstar Dispatch. I am Dana from the team.
>
> Two questions so I can point you to the right place: roughly how many technicians do you dispatch, and what are you hoping the dispatch board will fix first?
>
> Dana

### comment (sokafor-ns)

approved

### comment

**2026-03-02 11:46 · AI agent · sent**
From: dana@northstardispatch.example (sent by the AI agent, not by Dana)
To: rosa.delgado@sunbeltrepair.example
Subject: Your Northstar Dispatch trial
Approved by: Sam Okafor, 2026-03-02 11:45
Follow-up due: 2026-03-05
Material: none

> Hi Rosa,
>
> I saw that Sunbelt Appliance Repair started a trial of Northstar Dispatch. I am Dana from the team.
>
> Two questions so I can point you to the right place: roughly how many technicians do you dispatch, and what are you hoping the dispatch board will fix first?
>
> Dana

### comment

**2026-03-03 13:20 · AI agent · reply**
From: rosa.delgado@sunbeltrepair.example
Subject: Re: Your Northstar Dispatch trial
Thread: mailbox of dana@northstardispatch.example, thread started 2026-03-02 11:46

> Hi Dana,
>
> We run about 120 technicians out of Phoenix and Tucson. The first thing to fix is reassigning jobs when a tech runs over, because our dispatchers do it by phone and overtime is the result. We are on QuickBooks Online. I decide this together with our COO, Mark Pierce.
>
> Rosa

### comment

**2026-03-03 13:28 · AI agent · found-out**
Customer check (CRM, by domain): not a customer (checked again before writing)
Our person in the thread (CRM, mailbox, calendar, card): none found. Dana's mailbox shows only the AI agent's own email of 2026-03-02, which does not count as Dana talking
Booking on the calendar: none
Company (Apollo): 140 employees, 120 technicians (Rosa confirms), appliance repair
Verdict: fits, and all three qualification answers are on the card. Fit: 120 technicians, QuickBooks Online. Task: reassigning jobs by phone when a technician runs over, overtime is the result. Decision maker: Rosa Delgado and Mark Pierce, COO. The booking link goes in this email.

### comment

**2026-03-03 13:35 · AI agent · draft**
To: rosa.delgado@sunbeltrepair.example
Subject: Re: Your Northstar Dispatch trial
Waits for: Sam Okafor (stage 1)
Material: none

> Hi Rosa,
>
> Thanks, that is clear. With 120 technicians you would be on Fleet, because Crew stops at 10 technicians. Fleet includes route optimization and QuickBooks sync.
>
> On a call I can walk through reassigning jobs on a real day, with you and Mark. Pick a time here: https://calendly.com/northstar-dispatch/intro-call
>
> Dana

### comment (sokafor-ns)

approved

### comment

**2026-03-03 13:51 · AI agent · sent**
From: dana@northstardispatch.example (sent by the AI agent, not by Dana)
To: rosa.delgado@sunbeltrepair.example
Subject: Re: Your Northstar Dispatch trial
Approved by: Sam Okafor, 2026-03-03 13:50
Follow-up due: 2026-03-06
Material: none

> Hi Rosa,
>
> Thanks, that is clear. With 120 technicians you would be on Fleet, because Crew stops at 10 technicians. Fleet includes route optimization and QuickBooks sync.
>
> On a call I can walk through reassigning jobs on a real day, with you and Mark. Pick a time here: https://calendly.com/northstar-dispatch/intro-call
>
> Dana

### comment

**2026-03-04 08:20 · AI agent · booking**
Meeting: 2026-03-10 11:00 (America/Phoenix, which is 14:00 Eastern), 30 minutes, with Dana Reyes
Invitee: rosa.delgado@sunbeltrepair.example (guests: Rosa Delgado, Mark Pierce)
Matched by: email, and company domain
Created after the AI agent's first email to this company: yes (booking created 2026-03-04 08:15, first sent 2026-03-02)
Qualification answers: fit: 120 technicians, QuickBooks Online; task: reassigning jobs by phone when a technician runs over; decision maker: Rosa Delgado and Mark Pierce, COO

### comment

**2026-03-04 08:22 · AI agent · handover**
To: Dana Reyes
Needs: host the intro call on 2026-03-10 at 11:00 America/Phoenix. Read the card first: 120 technicians in Phoenix and Tucson, QuickBooks Online, Rosa and Mark Pierce decide together. The AI agent told them Fleet fits 120 technicians, with route optimization and QuickBooks sync, and promised nothing about overtime.
Because: a booked call is a person's work. Follow-ups are stopped and the AI agent sends nothing more to this company. Label set to Booked.
Lead's last message: Rosa Delgado, 2026-03-03 13:20: reassigning jobs by phone when a technician runs over is the first thing to fix
