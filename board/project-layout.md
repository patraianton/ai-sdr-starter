# GitHub Projects layout

Step 2 of the guide. The cards are GitHub Issues. A GitHub Project shows the same cards in status columns, so you see at a glance how many wait for a reply, how many are booked and how many are parked.

## Create the project

1. Open your user or organization page on GitHub, then Projects, then New project.
2. Choose the Board layout and name the project `SDR board`.
3. Add the repository's issues: in the project, open Workflows and turn on "Auto-add to project" for this repository. Also turn on the workflow that handles closed items.

## The columns

One column per label, in the order of the funnel:

1. New reply
2. Draft ready
3. Sent, waiting
4. Booked
5. Call held
6. Parked
7. No fit
8. Do not write
9. Our person is in the thread

GitHub builds the columns of a board from one single-choice field. It does not copy labels into that field by itself. So there are two ways to keep the columns equal to the labels:

- **Table view grouped by Labels (recommended, no upkeep).** In the project, add a Table view, choose Group by, then Labels. The groups are always the labels, because the label is the status and the AI agent moves the label.
- **Board view with a Status field.** Name the Status options exactly as the nine labels. You then move a card in two places, which is why this is the second choice. The label stays the truth: if the column and the label disagree, the label is right.

Add the filter `is:open` to the view you look at every day. Keep a second view with no filter for the closed "No fit" cards.

## What the AI agent needs

The AI agent's GitHub App needs permission for Issues (read and write) and nothing else. It does not touch the project. A project is for people to look at.

## The phone

The GitHub app on your phone shows the same issues. From it you can read a thread, comment `approved` on a draft (see `rules/08-approval-and-people.md`) and set a stop label: open the card, tap Labels, choose "Do not write" or "Our person is in the thread". That is all the board needs from your phone.
