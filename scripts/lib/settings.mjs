// scripts/lib/settings.mjs
// Guide: Step 1 (the small settings) and Step 2 (the labels list).
//
// A small YAML parser, only as large as rules/settings.yml, board/labels.yml and
// knowledge/materials/index.yml need. No dependencies. It also holds the few shared
// paths and helpers every script uses: the repository root, the fixtures folder,
// the .env reader and the argument reader.
//
// WHAT THE PARSER READS
//   - Scalars: whole numbers (1), decimals (0.0), true and false, null and ~, plain text (Mon, B, en).
//   - Quoted text with double quotes (escapes \" \\ \n \t) or single quotes (doubled '' for a quote).
//     Quote any value that must stay text: "09:00-17:00", "1D76DB", "".
//   - Inline lists of scalars on one line: [], [3, 7, 14], [Mon, Tue, Wed], ["a, b", c].
//   - Maps, nested by indentation (spaces only, any consistent step), to any depth.
//   - Block lists: "- value" lines, and lists of flat maps ("- name: x" followed by more keys).
//   - Comments: "# text" at the start of a line or after a space, outside quotes.
//
// WHAT IT DOES NOT READ (it stops with an error that names the line)
//   - Tabs for indentation, anchors and aliases (&, *), tags (!), documents (---),
//     multi-line text (| and >), inline maps ({a: 1}, except {}), lists inside inline lists,
//     keys with a colon inside, and text that runs over several lines.
//   - YAML 1.1 words such as yes, no, on, off are plain text here, not booleans.
//   - A number written with a leading zero or an exponent is plain text unless it is a plain
//     whole number or decimal. Quote anything you need as text.
//   - Duplicate keys in one map are an error.
//
// If you need more than this, change the file to fit the parser, or add a real YAML library.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = path.resolve(SCRIPTS_DIR, '..');
export const FIXTURES_DIR = path.join(SCRIPTS_DIR, 'fixtures');

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function syntaxError(label, lineNo, message) {
  return new Error(`${label}: line ${lineNo}: ${message}`);
}

// A quote opens only where a value can start, so "Don't" is not treated as a quote.
function opensQuote(text, index) {
  if (index === 0) return true;
  const before = text[index - 1];
  return before === ' ' || before === '[' || before === ',' || before === '{';
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (quote === '"' && ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if ((ch === '"' || ch === "'") && opensQuote(line, i)) {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function readQuoted(text, label, lineNo) {
  const quote = text[0];
  let value = '';
  let i = 1;
  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (quote === '"' && ch === '\\') {
      const next = text[i + 1];
      value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
      i += 1;
    } else if (ch === quote) {
      if (quote === "'" && text[i + 1] === "'") {
        value += "'";
        i += 1;
      } else {
        break;
      }
    } else {
      value += ch;
    }
  }
  if (i >= text.length) throw syntaxError(label, lineNo, 'a quoted text is not closed');
  if (text.slice(i + 1).trim() !== '') throw syntaxError(label, lineNo, 'text after the closing quote');
  return value;
}

function splitInline(inner, label, lineNo) {
  const parts = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (quote) {
      current += ch;
      if (quote === '"' && ch === '\\') {
        current += inner[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
    } else if ((ch === '"' || ch === "'") && /^\s*$/.test(current)) {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      parts.push(current);
      current = '';
    } else if (ch === '[' || ch === '{') {
      throw syntaxError(label, lineNo, 'a list inside a list is not supported');
    } else {
      current += ch;
    }
  }
  if (quote) throw syntaxError(label, lineNo, 'a quoted text is not closed');
  parts.push(current);
  return parts;
}

function parseScalar(raw, label, lineNo) {
  const text = raw.trim();
  if (text === '') return null;
  const first = text[0];
  if (first === '"' || first === "'") return readQuoted(text, label, lineNo);
  if (first === '[') {
    if (!text.endsWith(']')) throw syntaxError(label, lineNo, 'a list must close on the same line');
    const inner = text.slice(1, -1);
    if (inner.trim() === '') return [];
    return splitInline(inner, label, lineNo).map((part) => {
      if (part.trim() === '') throw syntaxError(label, lineNo, 'an empty item in a list');
      return parseScalar(part, label, lineNo);
    });
  }
  if (first === '{') {
    if (text === '{}') return {};
    throw syntaxError(label, lineNo, 'inline maps are not supported');
  }
  if (first === '|' || first === '>') throw syntaxError(label, lineNo, 'multi-line text is not supported');
  if (first === '&' || first === '*' || first === '!') throw syntaxError(label, lineNo, 'anchors, aliases and tags are not supported');
  if (text === 'true' || text === 'True') return true;
  if (text === 'false' || text === 'False') return false;
  if (text === 'null' || text === 'Null' || text === '~') return null;
  if (/^[-+]?\d+$/.test(text) && !/^[-+]?0\d/.test(text)) return Number(text);
  if (/^[-+]?\d+\.\d+$/.test(text)) return Number(text);
  return text;
}

// Finds the colon that ends a key. Returns { key, rest } or null when the text is not "key: value".
function splitKey(text, label, lineNo) {
  if (text[0] === '"' || text[0] === "'") {
    const quote = text[0];
    let i = 1;
    for (; i < text.length; i += 1) {
      if (quote === '"' && text[i] === '\\') i += 1;
      else if (text[i] === quote) break;
    }
    if (i >= text.length) return null;
    const after = text.slice(i + 1);
    if (!/^\s*:(\s|$)/.test(after)) return null;
    return { key: readQuoted(text.slice(0, i + 1), label, lineNo), rest: after.replace(/^\s*:/, '').trim() };
  }
  const match = /^([^\s:"'\[\]{},#][^:]*?)\s*:(\s+(.*))?$/.exec(text);
  if (!match) return null;
  return { key: match[1], rest: (match[3] ?? '').trim() };
}

const isItem = (text) => text === '-' || text.startsWith('- ');

export function parseYaml(source, label = 'yaml') {
  const lines = [];
  String(source)
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const lead = raw.match(/^[ \t]*/)[0];
      if (lead.includes('\t')) {
        if (stripComment(raw).trim() === '') return;
        throw syntaxError(label, index + 1, 'tabs are not allowed for indentation');
      }
      const body = stripComment(raw).replace(/\s+$/, '');
      if (body.trim() === '') return;
      if (body.trim() === '---' || body.trim() === '...') {
        throw syntaxError(label, index + 1, 'YAML documents ("---") are not supported');
      }
      lines.push({ indent: lead.length, text: body.slice(lead.length), no: index + 1 });
    });
  if (lines.length === 0) return {};

  let pos = 0;

  const parseNode = (indent) => (isItem(lines[pos].text) ? parseList(indent) : parseMap(indent));

  function parseList(indent) {
    const result = [];
    while (pos < lines.length && lines[pos].indent === indent && isItem(lines[pos].text)) {
      const line = lines[pos];
      const rest = line.text === '-' ? '' : line.text.slice(2).trimStart();
      if (rest === '') {
        pos += 1;
        const next = lines[pos];
        result.push(next && next.indent > indent ? parseNode(next.indent) : null);
      } else if (splitKey(rest, label, line.no)) {
        const virtualIndent = indent + (line.text.length - rest.length);
        lines[pos] = { indent: virtualIndent, text: rest, no: line.no };
        result.push(parseMap(virtualIndent));
      } else {
        result.push(parseScalar(rest, label, line.no));
        pos += 1;
      }
    }
    return result;
  }

  function parseMap(indent) {
    const result = {};
    while (pos < lines.length && lines[pos].indent === indent && !isItem(lines[pos].text)) {
      const line = lines[pos];
      const pair = splitKey(line.text, label, line.no);
      if (!pair) throw syntaxError(label, line.no, `expected "key: value", found "${line.text}"`);
      if (Object.prototype.hasOwnProperty.call(result, pair.key)) {
        throw syntaxError(label, line.no, `the key "${pair.key}" appears twice`);
      }
      pos += 1;
      if (pair.rest !== '') {
        result[pair.key] = parseScalar(pair.rest, label, line.no);
      } else {
        const next = lines[pos];
        const nested = next && (next.indent > indent || (next.indent === indent && isItem(next.text)));
        result[pair.key] = nested ? parseNode(next.indent) : null;
      }
    }
    return result;
  }

  const first = lines[0];
  const result = parseNode(first.indent);
  if (pos < lines.length) {
    const stray = lines[pos];
    throw syntaxError(label, stray.no, 'unexpected indentation or line');
  }
  return result;
}

export function readYamlFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${path.relative(ROOT, file) || file}: ${error.code ?? error.message}`);
  }
  return parseYaml(text, path.relative(ROOT, file) || file);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Adds `setups`: the setup value as a list of numbers (1, or [1, 3], becomes [1] or [1, 3]).
export function normalizeSettings(raw) {
  const setups = (Array.isArray(raw.setup) ? raw.setup : [raw.setup]).filter((value) => value !== null && value !== undefined);
  return { ...raw, setups };
}

export function loadSettings(rulesDir) {
  return normalizeSettings(readYamlFile(path.join(rulesDir, 'settings.yml')));
}

// Returns a list of plain-language problems with the shape of settings.yml. An empty list means the shape is right.
export function settingsProblems(settings) {
  const problems = [];
  const need = (ok, text) => {
    if (!ok) problems.push(text);
  };
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const setups = settings.setups ?? [];
  need(setups.length > 0 && setups.every((n) => [1, 2, 3].includes(n)), 'setup must be 1, 2, 3 or a list such as [1, 3]');
  need(['A', 'B', 'C'].includes(settings.engine), 'engine must be A, B or C');
  need(isObject(settings.approval), 'approval must be a map');
  if (isObject(settings.approval)) {
    need([1, 2, 3].includes(settings.approval.stage), 'approval.stage must be 1, 2 or 3');
    for (const key of ['approver', 'waiting_list_answerer', 'call_host', 'switch_owner']) {
      need(typeof settings.approval[key] === 'string', `approval.${key} must be text (it may be empty in the template)`);
    }
  }
  need(typeof settings.language === 'string', 'language must be text');
  need(typeof settings.tone === 'string', 'tone must be text');
  need(isObject(settings.email), 'email must be a map');
  if (isObject(settings.email)) {
    const email = settings.email;
    need(typeof email.max_words === 'number', 'email.max_words must be a number');
    need(typeof email.follow_ups === 'number', 'email.follow_ups must be a number');
    need(Array.isArray(email.follow_up_days) && email.follow_up_days.every((n) => typeof n === 'number'), 'email.follow_up_days must be a list of numbers');
    need(Array.isArray(email.sending_days) && email.sending_days.every((d) => WEEKDAYS.includes(d)), 'email.sending_days must be a list of Mon to Sun');
    need(typeof email.sending_hours === 'string', 'email.sending_hours must be text such as "09:00-17:00"');
    need(typeof email.timezone === 'string', 'email.timezone must be text');
    need(typeof email.booking_link === 'string', 'email.booking_link must be text');
    need(typeof email.daily_cap === 'number', 'email.daily_cap must be a number');
  }
  need(isObject(settings.icp) && typeof settings.icp.size_floor === 'number', 'icp.size_floor must be a number');
  need(isObject(settings.launch), 'launch must be a map');
  if (isObject(settings.launch)) {
    need(typeof settings.launch.new_contacts_per_week === 'number', 'launch.new_contacts_per_week must be a number');
    need(typeof settings.launch.emails_per_mailbox_per_day === 'number', 'launch.emails_per_mailbox_per_day must be a number');
    need(typeof settings.launch.pause_at_bounce_rate === 'number', 'launch.pause_at_bounce_rate must be a number');
  }
  need(typeof settings.sending_flag_file === 'string' && settings.sending_flag_file !== '', 'sending_flag_file must be a file name');
  return problems;
}

// ---------------------------------------------------------------------------
// Environment, arguments, fixtures
// ---------------------------------------------------------------------------

// Reads KEY=value lines from .env in the repository root. Values already in the environment win.
export function loadEnv(file = path.join(ROOT, '.env')) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.includes('"', 1)) || (value.startsWith("'") && value.includes("'", 1))) {
      value = value.slice(1, value.indexOf(value[0], 1));
    } else {
      value = value.replace(/(^|\s)#.*$/, '').trim();
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
  return true;
}

// parseArgs(argv, { flags: ['help', 'live'], options: ['rules', 'now'] }) -> { help: true, rules: 'x', _: [] }
export function parseArgs(argv, spec = {}) {
  const flags = new Set(['help', 'live', ...(spec.flags ?? [])]);
  const options = new Set(spec.options ?? []);
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h') {
      result.help = true;
    } else if (arg.startsWith('--')) {
      const [name, inline] = arg.slice(2).split(/=(.*)/s);
      if (flags.has(name)) {
        result[name] = true;
      } else if (options.has(name)) {
        const value = inline ?? argv[(i += 1)];
        if (value === undefined) throw new Error(`--${name} needs a value`);
        result[name] = value;
      } else {
        throw new Error(`unknown option --${name} (try --help)`);
      }
    } else {
      result._.push(arg);
    }
  }
  if (result.live) process.env.DRY_RUN = '0';
  return result;
}

export function loadFixture(name) {
  const file = path.join(FIXTURES_DIR, name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// The rules folder a script reads. A live run reads rules/. A dry run reads the filled example,
// so the fixtures and the settings belong to the same company. --rules or RULES_DIR overrides both.
export function resolveRulesDir(args, dry, env = process.env) {
  const chosen = args.rules ?? env.RULES_DIR;
  if (chosen) return path.resolve(chosen);
  return path.join(ROOT, dry ? path.join('examples', 'northstar', 'rules') : 'rules');
}
