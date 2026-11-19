// GET /api/health -> shows setup status (names only, never secret values).
const { send, dbType } = require('./_lib');
module.exports = (req, res) => {
  send(res, 200, {
    ok: true,
    passwordSet: true,
    usingBuiltInPassword: !process.env.DASHBOARD_PASSWORD,
    databaseConnected: !!dbType(),
    databaseType: dbType() || 'none',
    databaseVariablesFound: Object.keys(process.env).filter((k) => /KV|REDIS|UPSTASH/i.test(k)).sort()
  });
};
