# The GitHub App

Step 2 of the guide, used by every step after it. The AI agent writes on the board as its own GitHub identity, a GitHub App, so every note shows who wrote it and a leaked key opens one repository, not your company's GitHub. You create the App once. It takes about ten minutes.

## What the key is for

The AI agent creates and updates the cards (GitHub Issues), sets the labels and writes the notes. It does nothing else on GitHub. `scripts/gh-app-token.mjs` turns the App's private key into a token that lives one hour, and the AI agent asks for a new one on every run.

## Create the App

1. On GitHub, open your account or organization settings, then Developer settings, then GitHub Apps, then New GitHub App.
2. Name it for its job, for example `your-company-ai-sdr`. The homepage can be your company site.
3. Turn **Webhook** off. The AI agent reads the board on every run, so it needs no calls from GitHub.
4. Under Repository permissions, set **Issues** to Read and write. Leave every other permission at No access. GitHub adds Metadata (read) by itself. Leave it.
5. Under "Where can this GitHub App be installed?", choose "Only on this account".
6. Press Create GitHub App. Copy the **App ID** from the top of the App's page.
7. On the same page, under Private keys, press Generate a private key. GitHub downloads a `.pem` file. Keep it outside the repository, for example `~/keys/ai-sdr.pem`, and never commit it.
8. In the left menu, press Install App and install it on **this one repository only**, your private copy of the template.
9. After the install, look at the address bar. It ends with `/installations/<number>`. That number is the **installation id**.

## Write the three values in `.env`

```
GITHUB_REPO=owner/name
GITHUB_APP_ID=<the App ID from step 6>
GITHUB_APP_INSTALLATION_ID=<the number from step 9>
GITHUB_APP_PRIVATE_KEY_PATH=/full/path/to/ai-sdr.pem
```

`GITHUB_REPO` is your copy, written as `owner/name`.

## The first call

This call reads nothing from your board and writes nothing. It asks GitHub for a token, prints only when the token expires and never prints the token:

```
node scripts/gh-app-token.mjs --check
```

If the key file is the problem, `node scripts/gh-app-token.mjs --sign-only` tests the key locally, with no network call.

| Answer | What it means |
|---|---|
| `ok: installation ... gave a token that expires at ...` | The App works. Go on. |
| `cannot run: missing GITHUB_APP_ID, ...` | A line in `.env` is empty. The message names it. |
| `cannot read the private key file` | The path in `GITHUB_APP_PRIVATE_KEY_PATH` is wrong. |
| A 401 or 404 from GitHub | The App ID, the installation id or the key file does not belong together. Check the App page again. |

## If the key leaks

On the App's page, delete the private key and generate a new one. The old key stops working at once. Write the new path in `.env`.
