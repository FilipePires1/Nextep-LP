// /api/submissions — Retorna submissões (lê de arquivo local em dev, Google Sheets em produção)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Tenta ler de arquivo local (dev)
  try {
    const fs = await import('fs');
    const path = await import('path');
    const file = path.join(process.cwd(), 'data', 'submissions.json');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return res.status(200).json({ source: 'local', submissions: data });
    }
  } catch (e) {
    // continua
  }

  // 2. Tenta ler de Google Sheets via CSV export
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (sheetId) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const response = await fetch(csvUrl);
      if (response.ok) {
        const csv = await response.text();
        const rows = parseCSV(csv);
        const submissions = rows.slice(1).map(row => ({
          _receivedAt: row[0],
          _type: row[1],
          _page: row[2],
          nome: row[3],
          empresa: row[4],
          email: row[5],
          whatsapp: row[6],
          segmento: row[7],
          servico: row[8],
          orcamento: row[9],
          prazo: row[10],
          descricao: row[11],
          portfolio: row[12]
        }));
        return res.status(200).json({ source: 'sheets', submissions });
      }
    } catch (e) {
      console.error('Erro ao ler Google Sheets:', e.message);
    }
  }

  return res.status(200).json({ source: 'none', submissions: [] });
}

// CSV parser simples (trata aspas e vírgulas dentro de campos)
function parseCSV(csv) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let field = '';
  let row = [];

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && csv[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}
