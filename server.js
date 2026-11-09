'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '3000', 10);

const EVOLUTION_URL = String(process.env.EVOLUTION_URL || '').replace(/\/+$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';
const NOTIFY_TO = String(process.env.NOTIFY_TO || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const FORM_LABELS = {
  contact: 'Contato - Site',
  lead: 'Solicitacao de Projeto',
  candidate: 'Candidatura - Vagas',
};

const FIELDS_BY_TYPE = {
  contact: [
    ['nome', 'Nome'],
    ['empresa', 'Empresa'],
    ['email', 'E-mail'],
    ['whatsapp', 'WhatsApp'],
    ['segmento', 'Segmento'],
    ['servico', 'Servico'],
    ['orcamento', 'Orcamento'],
    ['prazo', 'Prazo'],
    ['descricao', 'Descricao'],
  ],
  lead: [
    ['nome', 'Nome'],
    ['empresa', 'Empresa'],
    ['email', 'E-mail'],
    ['whatsapp', 'WhatsApp'],
    ['segmento', 'Segmento'],
    ['servico', 'Servico'],
    ['orcamento', 'Orcamento'],
    ['prazo', 'Prazo'],
    ['descricao', 'Descricao'],
  ],
  candidate: [
    ['nome', 'Nome'],
    ['email', 'E-mail'],
    ['whatsapp', 'WhatsApp'],
    ['cidade', 'Cidade/Estado'],
    ['linkedin', 'LinkedIn'],
    ['github', 'GitHub'],
    ['portfolio', 'Portfolio'],
    ['experiencia', 'Experiencia'],
    ['sobre', 'Sobre voce'],
    ['carta', 'Carta'],
  ],
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Payload muito grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

function buildMessage(formType, fields, page) {
  const title = FORM_LABELS[formType] || 'Formulario - Site';
  const lines = ['*Novo formulario: ' + title + '*'];
  const pairs = FIELDS_BY_TYPE[formType] || FIELDS_BY_TYPE.contact;
  for (const [key, label] of pairs) {
    const raw = fields[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).replace(/\s+/g, ' ').trim();
    if (!value) continue;
    lines.push(label + ': ' + (value.length > 400 ? value.slice(0, 400) + '...' : value));
  }
  if (page) lines.push('Pagina: ' + page);
  lines.push(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  return lines.join('\n');
}

async function sendWhatsApp(number, text) {
  if (!EVOLUTION_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) return { ok: false, error: 'not configured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `${EVOLUTION_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: 'POST',
        headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text }),
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, status: response.status, error: detail.slice(0, 200) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function handleNotify(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: 'JSON invalido' });
  }

  const formType = String(body.formType || 'contact');
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const page = String(body.page || '').slice(0, 120);

  if (NOTIFY_TO.length === 0) {
    return sendJson(res, 200, { ok: true, skipped: 'NOTIFY_TO nao configurado' });
  }

  const text = buildMessage(formType, fields, page);
  const results = await Promise.all(
    NOTIFY_TO.map(async (raw) => {
      const number = normalizePhone(raw);
      const result = await sendWhatsApp(number, text);
      if (!result.ok) console.error('[notify] falha para', number, result);
      return result;
    })
  );

  const sent = results.filter((r) => r.ok).length;
  return sendJson(res, 200, { ok: true, sent, total: NOTIFY_TO.length });
}

function sendFile(res, file, stat, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=86400',
  });
  if (res.req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return sendJson(res, 400, { error: 'URL invalida' });
  }
  if (pathname.includes('\0')) return sendJson(res, 400, { error: 'URL invalida' });

  const candidates = [];
  if (pathname.endsWith('/')) {
    candidates.push(pathname + 'index.html');
  } else {
    candidates.push(pathname);
    candidates.push(pathname + '/index.html');
    candidates.push(pathname + '.html');
  }

  for (const candidate of candidates) {
    const file = path.resolve(ROOT, '.' + candidate);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) continue;
    try {
      const stat = fs.statSync(file);
      if (stat.isFile()) return sendFile(res, file, stat);
    } catch {
      // tenta o proximo
    }
  }

  const notFound = path.join(ROOT, '404.html');
  if (fs.existsSync(notFound)) {
    return sendFile(res, notFound, fs.statSync(notFound), 404);
  }
  return sendJson(res, 404, { error: 'Nao encontrado' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
  }

  if (url.pathname === '/api/notify') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    return handleNotify(req, res);
  }

  if (url.pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  return serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Nextep site ouvindo em :${PORT}`);
});
