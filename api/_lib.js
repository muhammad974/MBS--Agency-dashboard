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

// Finds an environment variable even when Vercel added a custom prefix (e.g. STORAGE_KV_REST_API_URL).
function findEnv(names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  for (const k of Object.keys(process.env)) {
    if (names.some((n) => k.endsWith('_' + n)) && process.env[k]) return process.env[k];
  }
  return '';
}
function dbConfig() {
  return {
    url: findEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']),
    token: findEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']),
    redisUrl: findEnv(['REDIS_URL'])
  };
}
function dbType() {
  const c = dbConfig();
  if (c.url && c.token) return 'upstash-rest';
  if (c.redisUrl) return 'redis-url';
  return '';
}

// Works with BOTH kinds of Vercel Redis databases:
//  1) Upstash Redis  -> REST API (KV_REST_API_URL + KV_REST_API_TOKEN), no packages needed
//  2) Redis (Redis Cloud) -> REDIS_URL connection string, uses the "redis" npm package
let tcpClient = null;
async function getTcpClient(url) {
  if (tcpClient && tcpClient.isOpen) return tcpClient;
  const { createClient } = require('redis');
  tcpClient = createClient({ url, socket: { connectTimeout: 6000, reconnectStrategy: false } });
  tcpClient.on('error', () => {});
  await tcpClient.connect();
  return tcpClient;
}

async function redis(command) {
  const c = dbConfig();
  if (c.url && c.token) {
    const r = await fetch(c.url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command)
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  if (c.redisUrl) {
    const client = await getTcpClient(c.redisUrl);
    return client.sendCommand(command.map(String));
  }
  throw new Error('Database not connected. Vercel > Storage mein Redis database is project se connect karein, phir Redeploy karein.');
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

module.exports = { sign, verify, authed, redis, send, readBody, getPassword, dbConfig, dbType };
