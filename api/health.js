// GET /api/health -> shows whether the two required settings are present (no secrets).
const { send } = require('./_lib');
module.exports = (req, res) => {
  send(res, 200, {
    ok: true,
    passwordSet: true,
    usingBuiltInPassword: !process.env.DASHBOARD_PASSWORD,
    databaseConnected: !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN))
  });
};
