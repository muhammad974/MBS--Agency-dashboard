// POST /api/login  { password }  ->  { token }
const crypto = require('crypto');
const { send, readBody, sign, redis } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return send(res, 500, { error: 'DASHBOARD_PASSWORD Vercel Environment Variables mein set nahi hai.' });

  // Limit guesses: 10 attempts per 15 minutes per IP.
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const key = 'mbs:ratelimit:' + ip;
  try {
    const n = await redis(['INCR', key]);
    if (n === 1) await redis(['EXPIRE', key, 900]);
    if (n > 10) return send(res, 429, { error: 'Bohat zyada koshishein. 15 minute baad dobara try karein.' });
  } catch (e) {
    return send(res, 503, { error: e.message });
  }

  let body = {};
  try { body = await readBody(req); } catch (e) { /* ignore */ }
  const a = crypto.createHash('sha256').update(String(body.password || '')).digest();
  const b = crypto.createHash('sha256').update(password).digest();
  if (!crypto.timingSafeEqual(a, b)) return send(res, 401, { error: 'Wrong password' });

  await redis(['DEL', key]).catch(() => {});
  send(res, 200, { token: sign({ exp: Date.now() + 60 * 24 * 3600 * 1000 }) });
};
