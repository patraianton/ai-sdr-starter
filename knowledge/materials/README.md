# Materials: case studies and one-pagers

Step 1 of the guide (product knowledge) and step 4 (material on request, tracked short links).

This folder holds your case studies and one-pagers. Each piece is a page or a file a lead can open: a page on your website, or a file in a shared drive. The list the AI agent picks from is `index.yml`.

## What goes in

- Case studies: one customer, one problem, one result, in the customer's industry.
- One-pagers: one page about one feature, one integration, or one system you connect to.

Keep the pieces themselves where leads can open them by link. Do not paste them into the repository unless they are short text you want the AI agent to read. In `examples/northstar/knowledge/materials/` two one-pagers are kept as markdown to show the shape.

## The list

`index.yml` has one entry per piece, with four fields:

| Field | Meaning |
|---|---|
| `id` | A short name with no spaces, used on the card, for example `hvac-case-study`. |
| `title` | The title as the lead would see it. |
| `audience` | The industry or the system the piece is for, for example `HVAC` or `QuickBooks`. For several, separate them with a comma. |
| `url` | The full address of the page or file. This is the target of the short link. |

One piece can only be linked once per lead, so keep one entry per real piece.

## How the AI agent picks a piece

1. The lead asks for something: a case study, an example, "what does it look like for a company like ours".
2. The AI agent reads the lead's industry and system from the card (the Apollo lookup and the lead's own words).
3. It looks in `index.yml` for the entry whose `audience` matches. An industry match comes first, a system match second.
4. If nothing matches, it does not send the closest one. It tells a person on the card and asks the lead one question in the meantime.

## How the AI agent sends it

1. It makes a short link for this lead alone, on your own short domain, through Short.io (see `connections/shortio.md`). The link points at the `url` of the piece. The `id` of the piece and the lead's company are written into the link's title, so the report can name them.
2. It puts the short link in the reply, not an attachment.
3. It writes the `Material:` line in the `draft` note and in the `sent` note on the card: `<piece id> / <short URL> / <idString>` (shape in `board/note-shapes.md`). The `sent` note holds the email exactly as sent. No separate note is needed.
4. On every later run it takes the `idString` from the `Material:` line and asks Short.io whether the link was opened. The first open becomes a `link-opened` note with its date, and the AI agent writes its next message then, while the lead is warm, not on the follow-up days.

## Rules

- Never send a piece that is not in `index.yml`.
- Never send the same piece twice to the same lead.
- Never use a UTM tag. The lead sees a clean short address.
- When a piece goes out of date, change its entry the same day. A wrong case study costs more than none.
