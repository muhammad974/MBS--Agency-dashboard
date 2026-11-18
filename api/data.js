// GET /api/data  -> { data, updatedAt }     PUT /api/data { data } -> { ok, updatedAt }
const { send, readBody, authed, redis } = require('./_lib');
const KEY = 'mbs:data';

module.exports = async (req, res) => {
  if (!authed(req)) return send(res, 401, { error: 'Unauthorized' });
  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      if (!raw) return send(res, 200, { data: null, updatedAt: 0 });
      const o = JSON.parse(raw);
      return send(res, 200, { data: o.data, updatedAt: o.updatedAt });
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (typeof body.data !== 'string' || body.data.length < 2) return send(res, 400, { error: 'Invalid data' });
      if (body.data.length > 700000) return send(res, 413, { error: 'Data bohat bara hai' });
      try {
        const parsed = JSON.parse(body.data);
        if (!parsed || !Array.isArray(parsed.clients) || !Array.isArray(parsed.projects)) throw new Error('shape');
      } catch (e) {
        return send(res, 400, { error: 'Data format theek nahi hai' });
      }
      // Daily safety copy: keep the data as it was before the first save of each day (45 days).
      const previous = await redis(['GET', KEY]);
      if (previous) {
        const day = new Date().toISOString().slice(0, 10);
        await redis(['SET', 'mbs:backup:' + day, previous, 'NX', 'EX', 60 * 60 * 24 * 45]).catch(() => {});
      }
      const updatedAt = Date.now();
      await redis(['SET', KEY, JSON.stringify({ data: body.data, updatedAt })]);
      return send(res, 200, { ok: true, updatedAt });
    }
    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 503, { error: e.message || 'Database error' });
  }
};
