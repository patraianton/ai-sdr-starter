#!/usr/bin/env node
// scripts/gh-app-token.mjs
// Guide: Step 2 (the AI agent's own identity: a GitHub App installed only on this repository).
//
// Turns the GitHub App's private key into a short-lived installation token (valid one hour).
// Zero dependencies: Node's own crypto signs the JWT (a short-lived proof of identity), fetch asks GitHub for the token.
//
// Usage:
//   GH_TOKEN=$(node scripts/gh-app-token.mjs)      print the token on one line, for a shell variable
//   node scripts/gh-app-token.mjs --check          get a token, print only when it expires, never the token
//   node scripts/gh-app-token.mjs --sign-only      sign the JWT locally to test the key file, no network call
//   node scripts/gh-app-token.mjs --help
//
// Reads GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID and GITHUB_APP_PRIVATE_KEY_PATH (see .env.example).
// DRY_RUN does not apply here: the script writes nothing, and the skills and CLAUDE.md call it to get a real
// token while DRY_RUN=1 is set in .env. It makes one call to GitHub and asks for a one-hour token.
// Exit codes: 0 ok, 3 could not run (the message names the missing key line).
//
// The token is the one value this script prints on purpose. Do not run it where its output is logged.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchJson, out, warn, redact } from './lib/http.mjs';
import { loadEnv, parseArgs } from './lib/settings.mjs';

const HELP = `gh-app-token: GitHub App private key -> installation token

Usage:
  GH_TOKEN=$(node scripts/gh-app-token.mjs)   print the token (for a shell variable)
  node scripts/gh-app-token.mjs --check       get a token and print only its expiry
  node scripts/gh-app-token.mjs --sign-only   sign a JWT (a short-lived proof of identity) locally to test the key file, no network call

Needs in .env: GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY_PATH
DRY_RUN does not apply: this script writes nothing and always asks GitHub for a real token.
Exit codes: 0 ok, 3 could not run.`;

const base64url = (value) => Buffer.from(value).toString('base64url');

// A JWT that proves the app's identity to GitHub. Backdated 60 seconds for clock skew, valid 9 minutes.
export function createJwt({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

export async function getInstallationToken({ appId, installationId, privateKey }) {
  const jwt = createJwt({ appId, privateKey });
  const answer = await fetchJson(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    vendor: 'GitHub',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ai-sdr-starter',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!answer?.token) throw new Error('GitHub answered without a token');
  return { token: answer.token, expiresAt: answer.expires_at };
}

export function appSettingsFromEnv(env = process.env) {
  const appId = env.GITHUB_APP_ID;
  const installationId = env.GITHUB_APP_INSTALLATION_ID;
  const keyPath = env.GITHUB_APP_PRIVATE_KEY_PATH;
  const missing = [
    ['GITHUB_APP_ID', appId],
    ['GITHUB_APP_INSTALLATION_ID', installationId],
    ['GITHUB_APP_PRIVATE_KEY_PATH', keyPath],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) return { missing };
  let privateKey;
  try {
    privateKey = fs.readFileSync(path.resolve(keyPath), 'utf8');
  } catch (error) {
    throw new Error(`cannot read the private key file named in GITHUB_APP_PRIVATE_KEY_PATH: ${error.code ?? error.message}`);
  }
  return { appId, installationId, privateKey };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { flags: ['check', 'sign-only'] });
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  loadEnv();
  const settings = appSettingsFromEnv();
  if (settings.missing) {
    warn(`cannot run: missing ${settings.missing.join(', ')} in .env`);
    return 3;
  }
  if (args['sign-only']) {
    const jwt = createJwt(settings);
    out(`ok: signed a JWT for app ${settings.appId} with the key file (${jwt.length} characters). No call was made.`);
    return 0;
  }
  const { token, expiresAt } = await getInstallationToken(settings);
  if (args.check) {
    out(`ok: installation ${settings.installationId} gave a token that expires at ${expiresAt}`);
  } else {
    process.stdout.write(`${token}\n`);
  }
  return 0;
}

const isEntry = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntry) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      warn(`cannot run: ${redact(error.message)}`);
      process.exit(3);
    },
  );
}
