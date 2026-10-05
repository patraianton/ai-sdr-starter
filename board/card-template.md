# The card

Step 2 of the guide. Every company gets one card: one GitHub Issue. This file is the empty lead record. `.github/ISSUE_TEMPLATE/lead-card.md` copies it, so a person who opens a card by hand gets the same shape the AI agent writes.

## Title

`<Company> (<domain>)`

Example: `Blue Ridge HVAC (blueridgehvac.example)`. The domain is the company's own web domain, in lower case, without `www.`. It is what the AI agent searches by, so never leave it out and never put a free-mail domain here.

## Body

The body opens with a table, then a line with three dashes, then the first note.

| Field | What goes in it |
|---|---|
| Company | The company name as the lead writes it. |
| Domain | The company web domain. The key for every search and every check. |
| Contacts | One person per line: name, email, title. Add a line when a second person from the same company writes. |
| Size | Employees or technicians, with the source in brackets, for example `42 technicians (Apollo)`. |
| Industry | One or two words, for example `HVAC`. |
| Country | Country, and state or province if known. |
| Source | The campaign or the sign-up the lead came from, with the date. |
| CRM record | A link to the lead in your CRM. The AI agent creates the lead before the first email. |
| Setup | 1, 2 or 3 (see `README.md` in the repository root). |

The first note is almost always a `found-out` note: what the checks in `rules/02-what-to-check.md` returned. Its shape is in `note-shapes.md`.

## The copy to paste

````markdown
| Field | Value |
|---|---|
| Company | |
| Domain | |
| Contacts | Name, email, title<br>Name, email, title |
| Size | |
| Industry | |
| Country | |
| Source | |
| CRM record | |
| Setup | |

---

**YYYY-MM-DD HH:MM · AI agent · found-out**
Customer check (CRM, by domain):
Our person in the thread (CRM, mailbox, calendar, card):
Booking on the calendar:
Company (Apollo):
Verdict:
````

## Rules for the record

- The record is the top of the issue body. The AI agent edits it only to add a contact or to correct a field it can prove, and it writes a `note` when it does.
- Never put a key, a password or a private link in the record.
- Notes go under the record: the first one in the body, every later one as a comment.
