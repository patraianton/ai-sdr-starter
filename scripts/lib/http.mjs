// scripts/lib/http.mjs
// Guide: Step 4 (connections) and Step 6 (the daily check).
//
// Three small helpers every script shares:
//   - isDryRun(): DRY_RUN is on unless it is set to 0, false, no or off.
//   - redact(): removes key values from any text before it is printed or stored.
//   - fetchJson(): one place for HTTP calls, with short retries and safe error text.
//
// Rule for keys (Step 4): a key value never appears in output, in a log or on a card.
// Every line the scripts print goes through out() or fail(), and both call redact().

const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD)/i;
const NOT_A_SECRET_NAME = /(_PATH|_FILE|_DOMAIN|_PROVIDER)$/i;

export function isDryRun(env = process.env) {
  const value = String(env.DRY_RUN ?? '1').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
}

// Values of every environment variable that looks like a key, at least 6 characters long.
export function secretValues(env = process.env) {
  const values = [];
  for (const [name, value] of Object.entries(env)) {
    if (typeof value !== 'string' || value.length < 6) continue;
    if (!SECRET_NAME.test(name) || NOT_A_SECRET_NAME.test(name)) continue;
    values.push(value);
  }
  // Longest first, so a key that contains another key is removed whole.
  return values.sort((a, b) => b.length - a.length);
}

const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted private key]'],
  [/(api_key=)[^&\s"']+/gi, '$1[redacted]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]+/g, '$1[redacted]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[redacted]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, '[redacted]'],
];

export function redact(text, env = process.env) {
  let result = String(text ?? '');
  for (const secret of secretValues(env)) result = result.split(secret).join('[redacted]');
  for (const [pattern, replacement] of PATTERNS) result = result.replace(pattern, replacement);
  return result;
}

export function out(...parts) {
  console.log(redact(parts.join(' ')));
}

export function warn(...parts) {
  console.error(redact(parts.join(' ')));
}

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function withoutQuery(url) {
  const text = String(url);
  const cut = text.indexOf('?');
  return cut === -1 ? text : text.slice(0, cut);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// fetchJson(url, { method, headers, json, body, vendor, timeoutMs, retries })
// Returns the parsed JSON, or null for an empty answer. Throws ApiError with redacted text.
export async function fetchJson(url, options = {}) {
  const { method = 'GET', headers = {}, json, body, vendor = 'API', timeoutMs = 30000, retries = 2 } = options;
  const init = { method, headers: { Accept: 'application/json', ...headers } };
  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers['Content-Type'] = 'application/json';
  } else if (body !== undefined) {
    init.body = body;
  }
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new ApiError(redact(`${vendor} ${method} ${withoutQuery(url)} failed: ${error.message}`));
    }
    const text = await response.text();
    if (response.ok) {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        throw new ApiError(`${vendor} ${method} ${withoutQuery(url)} returned text that is not JSON`, response.status);
      }
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < retries) {
      const wait = Number(response.headers.get('retry-after')) || attempt + 1;
      await sleep(Math.min(wait, 10) * 1000);
      continue;
    }
    const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
    throw new ApiError(
      redact(`${vendor} ${method} ${withoutQuery(url)} -> HTTP ${response.status}: ${snippet}`),
      response.status,
    );
  }
}
