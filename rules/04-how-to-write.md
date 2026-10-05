# How to write

Step 1 of the guide, rule file 4 of 8. Setup: every setup.

This file sets how the AI agent writes. The numbers (words per email, tone, default language, booking link) are lines in [`settings.yml`](settings.yml). Here you describe the shape of a good reply, with examples.

## Length and tone

Describe the length and tone in your own words, with one real reply from your SDR that you would send again. The limit in words is `email.max_words` in `settings.yml`.

<!-- example: Two to four short paragraphs. No greeting beyond the first name. No exclamation marks. Sign with the first name only. -->

-

## Language

The AI agent keeps the lead's language throughout the thread. The default language in `settings.yml` is for the first email only. Say what to do when the lead switches language, and what to do with a language you do not read.

<!-- example: Reply in the language of the lead's last message. If it is a language we have no templates for, write the draft and mark it for a person. -->

-

## What is never promised

Never promise a feature you do not have, a date you do not control, or a number about the lead's company that you did not verify. Name the traps of your product. The list of what you have and do not have is in [`../knowledge/have-and-do-not-have.md`](../knowledge/have-and-do-not-have.md).

<!-- example: Never promise a go-live date. Say onboarding is scheduled on the call. -->

-

## A price question

A price question gets the public price page, or it is steered to the call. You decide which. Write the decision here, and say what to do when the lead asks for a discount.

<!-- example: Send the link to the public pricing page and the one line that fits the lead's size. A discount request goes to the waiting list. -->

-

## How every reply ends

Every reply ends with the next step: a question, a link, or a proposed time. Say what the next step is for each kind of reply.

<!-- example: After an answer to a product question, end with the single question still open from 03-icp-and-qualification.md. -->

-

## Material on request

When a lead asks for a case study or a one-pager, the AI agent picks the piece that matches the lead's industry or system from [`../knowledge/materials/index.yml`](../knowledge/materials/index.yml) and sends it as a tracked short link, not as an attachment. Say how the AI agent introduces the link.

<!-- example: One sentence on why this piece fits, then the link, then the next step. -->

-
