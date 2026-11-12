export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    turnstileSiteKey: String(process.env.TURNSTILE_SITE_KEY || '').trim()
  });
}
