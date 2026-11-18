// Shared helpers for the MBS dashboard backend (Vercel serverless functions).
const crypto = require('crypto');

// Password: the Vercel variable DASHBOARD_PASSWORD wins if it is set, otherwise this built-in one is used.
const DEFAULT_PASSWORD = 'muhammad54321_';
function getPassword() {
  return process.env.DASHBOARD_PASSWORD || DEFAULT_PASSWORD;
}

function getSecret() {
  return process.env.AUTH_SECRET ||
    crypto.createHash('sha256').update('mbs:' + getPassword()).digest('hex');
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1] || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch (e) {
    return null;
  }
}

function authed(req) {
  const h = req.headers.authorization || '';
  return verify(h.startsWith('Bearer ') ? h.slice(7) : '');
}

// Talks to Upstash Redis through its REST API (no npm packages needed).
async function redis(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Database not connected. Vercel > Storage mein Upstash Redis connect karein.');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : {};
}

module.exports = { sign, verify, authed, redis, send, readBody, getPassword };
