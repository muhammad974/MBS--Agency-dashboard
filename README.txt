MBS AGENCY DASHBOARD  (with backend)

Is folder mein ye cheezein hain:
  index.html      -> dashboard (isme aap ke clients ka data nahi hai)
  api/            -> backend (login + data save)
  vercel.json, package.json

GitHub par is folder ke andar ki SAARI files upload karein (api folder samet).
Phir Vercel par import karein, aur Environment Variables mein ye daalein:
  DASHBOARD_PASSWORD = aap ka password
Aur Vercel > Storage mein "Upstash Redis" create karke project se connect karein.

Setup check karne ke liye live link ke aage /api/health kholein:
  {"ok":true,"passwordSet":true,"databaseConnected":true}  aana chahiye.
