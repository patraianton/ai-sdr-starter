# Product knowledge

Step 1 of the guide, the second half: "Product knowledge". This folder is a template. Every file has its headings, a short note on what goes under each heading, one example line in a comment, and an empty list for you to fill. A filled copy for a made-up company is in `examples/northstar/knowledge/`.

## What this folder is for

The AI agent answers a lead's questions about your product from these files and from nothing else. An invented feature or a made-up number is the AI agent's most common mistake. The files below, together with the hard rule "never a product fact or number that is not in `knowledge/`" in `rules/06-hard-rules.md`, are the fix.

## The files

| File | What it holds |
|---|---|
| `plans-and-prices.md` | Plans and prices, exactly as on your public price page. |
| `faq.md` | The questions leads ask every week, each with its answer. |
| `objections.md` | The objections your sales rep hears most, each with its answer. |
| `have-and-do-not-have.md` | What your product has, and what it does not have. |
| `materials/` | Case studies and one-pagers, and the list the AI agent picks from. |

## How to write them

1. Copy from the source, do not paraphrase. Prices are copied from the public price page. Answers are copied from your SDR's real replies in the threads you exported.
2. One fact per line. The AI agent reads every line on every run, so short lines are cheaper and clearer than paragraphs.
3. Write the answer a lead should get, in the voice of `rules/04-how-to-write.md`. Do not write notes to yourself.
4. Put the source and the date of the last check on top of each file. A price that nobody has checked for a year is a risk.
5. Delete the example comments before the first run. The AI agent reads every line of these files, so a left-in example is read as a fact about your product.

## When the AI agent does not find the answer

A question that is not answered in these files goes to a person. The AI agent says so on the card and the person answers. Then a person adds the answer to the file the same day, so the question is asked once. The AI agent never edits these files. That is how these files grow: from real questions, not from guessing what leads might ask.

## Keep it true

When a price, a plan or a feature changes, change the file first, on the same day. The AI agent reads the files at the start of every run, so the next run already uses the new version.
