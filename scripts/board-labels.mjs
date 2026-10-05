#!/usr/bin/env node
// scripts/board-labels.mjs
// Guide: Step 2 (the board). Creates the nine status labels from board/labels.yml in your GitHub repository.
//
// Safe to run again and again: a label that is missing is created, a label whose colour or description differs is
// updated, a label that already matches is left alone. It never deletes a label, so your own labels stay.
// The first-run-setup skill calls this script on the AI agent's first run.
//
// A dry run changes nothing. When .env names your repository and a way to sign in, the dry run still reads your
// repository's labels (reading changes nothing), so the plan shows which labels really exist. Without them, the plan
// is made against a fixture repository.
//
// Usage:
//   node scripts/board-labels.mjs               show the plan on fixtures (DRY_RUN=1 is the default), change nothing
//   DRY_RUN=0 node scripts/board-labels.mjs     create and update the labels in GITHUB_REPO (or: --live)
//   node scripts/board-labels.mjs --help
// Exit codes: 0 ok, 3 could not run.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLabel, githubConfigured, listLabels, updateLabel } from './lib/github.mjs';
import { isDryRun, out, redact, warn } from './lib/http.mjs';
import { ROOT, loadEnv, parseArgs, readYamlFile } from './lib/settings.mjs';

const HELP = `board-labels: create or update the nine labels from board/labels.yml (safe to run again, never deletes).

Usage:
  node scripts/board-labels.mjs [--file <labels.yml>] [--live]

Options:
  --file <path>   labels file to read (default: board/labels.yml)
  --live          same as DRY_RUN=0
  --help          this text

DRY_RUN=1 (default): prints the plan and changes nothing. It compares with your repository's labels when GITHUB_REPO
and a sign-in are set in .env (reading only), and with a fixture repository otherwise.
Needs for a live run: GITHUB_REPO and a GitHub sign-in (see .env.example).
Exit codes: 0 ok, 3 could not run.`;

const cleanColor = (value) => String(value ?? '').replace(/^#/, '').toLowerCase();

export function validateLabels(labels) {
  if (!Array.isArray(labels) || labels.length === 0) throw new Error('labels file: expected a list of labels');
  const seen = new Set();
  for (const label of labels) {
    if (!label || typeof label.name !== 'string' || !label.name) throw new Error('labels file: every label needs a name');
    if (!/^[0-9a-f]{6}$/i.test(cleanColor(label.color))) throw new Error(`labels file: "${label.name}" needs a 6-digit hex colour`);
    if (seen.has(label.name.toLowerCase())) throw new Error(`labels file: "${label.name}" appears twice`);
    seen.add(label.name.toLowerCase());
  }
  return labels;
}

// Compares wanted labels with the labels in the repository. Returns [{ action: 'create' | 'update' | 'keep', label }].
export function planLabels(wanted, existing) {
  const byName = new Map(existing.map((label) => [label.name.toLowerCase(), label]));
  return wanted.map((label) => {
    const found = byName.get(label.name.toLowerCase());
    if (!found) return { action: 'create', label };
    const same = cleanColor(found.color) === cleanColor(label.color) && (found.description ?? '') === (label.description ?? '') && found.name === label.name;
    return { action: same ? 'keep' : 'update', label };
  });
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, { options: ['file'] });
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  loadEnv();
  const dry = isDryRun();
  const file = path.resolve(args.file ?? path.join(ROOT, 'board', 'labels.yml'));
  const wanted = validateLabels(readYamlFile(file));
  const real = !dry || githubConfigured();
  const existing = await listLabels({ live: real });
  const plan = planLabels(wanted, existing);

  out(`Labels${dry ? ' (dry run)' : ''}: ${wanted.length} wanted from ${path.relative(ROOT, file)}, compared with ${real ? process.env.GITHUB_REPO : 'a fixture repository'}`);
  for (const { action, label } of plan) {
    out(`  ${action.padEnd(6)} ${label.name}`);
    const color = cleanColor(label.color).toUpperCase();
    if (dry) continue; // the plan above is all a dry run shows
    if (action === 'create') await createLabel({ name: label.name, color, description: label.description });
    if (action === 'update') await updateLabel({ name: label.name, color, description: label.description });
  }
  const count = (action) => plan.filter((entry) => entry.action === action).length;
  out(`Done: ${count('create')} created, ${count('update')} updated, ${count('keep')} already right.`);
  if (dry) out('[dry run] nothing was changed. Run with DRY_RUN=0 (or --live) to apply the plan.');
  return 0;
}

const isEntry = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntry) {
  run().then(
    (code) => process.exit(code),
    (error) => {
      warn(`cannot run: ${redact(error.message)}`);
      process.exit(3);
    },
  );
}
