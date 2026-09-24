// /api/submit — Vercel Serverless Function
// Recebe POST dos formulários e armazena no filesystem (dev) + envia ao Google Sheets

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!data) return res.status(400).json({ error: 'No data' });

    // Log no console do Vercel
    console.log('[NexTep Form]', data._type, data._timestamp, data.email || data.nome);

    // Se tiver GOOGLE_SHEET_WEBHOOK configurado, encaminha para Google Sheets
    const sheetHook = process.env.GOOGLE_SHEET_WEBHOOK;
    if (sheetHook) {
      try {
        await fetch(sheetHook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (e) {
        console.error('Falha ao enviar para Google Sheets:', e.message);
      }
    }

    // Salva localmente em dev (fora da Vercel o filesystem funciona)
    if (process.env.VERCEL !== '1') {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const dir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'submissions.json');
        let existing = [];
        if (fs.existsSync(file)) {
          existing = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        existing.push({ ...data, _receivedAt: new Date().toISOString() });
        fs.writeFileSync(file, JSON.stringify(existing, null, 2));
      } catch (e) {
        console.error('Falha ao salvar local:', e.message);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
