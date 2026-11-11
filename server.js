'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '3000', 10);

const HUB_SUPPORT_URL = String(process.env.HUB_SUPPORT_URL || '').replace(/\/+$/, '');
const HUB_SUPPORT_API_KEY = process.env.HUB_SUPPORT_API_KEY || '';
const HUB_SUPPORT_SYSTEM_KEY = process.env.HUB_SUPPORT_SYSTEM_KEY || 'nextep-site';

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

function buildDescription(formType, fields, page) {
  const title = FORM_LABELS[formType] || 'Formulário - Site';
  const lines = ['Formulário: ' + title];
  if (page) lines.push('Página: ' + page);
  lines.push('');
  const pairs = FIELDS_BY_TYPE[formType] || FIELDS_BY_TYPE.contact;
  for (const [key, label] of pairs) {
    const raw = fields[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).replace(/\r/g, '').trim();
    if (!value) continue;
    lines.push(label + ': ' + (value.length > 1200 ? value.slice(0, 1200) + '...' : value));
  }
  lines.push('');
  lines.push('Recebido em: ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  return lines.join('\n').slice(0, 5000);
}

function buildTitle(formType, fields) {
  const label = FORM_LABELS[formType] || 'Formulário - Site';
  const name = String(fields.nome || fields.email || '').trim();
  return (name ? label + ': ' + name : label).slice(0, 200);
}

function moduleForForm(formType) {
  if (formType === 'lead') return 'site-proposta';
  if (formType === 'candidate') return 'site-carreiras';
  return 'site-contato';
}

function priorityForForm(formType) {
  if (formType === 'lead') return 'high';
  if (formType === 'candidate') return 'low';
  return 'medium';
}

async function handleForms(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: 'JSON inválido' });
  }

  const formType = String(body.formType || 'contact');
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const page = String(body.page || '').slice(0, 120);

  if (!fields.nome || !String(fields.nome).trim()) {
    return sendJson(res, 400, { ok: false, error: 'Informe seu nome.' });
  }
  if (!fields.email || !String(fields.email).trim()) {
    return sendJson(res, 400, { ok: false, error: 'Informe seu e-mail.' });
  }

  if (!HUB_SUPPORT_URL || !HUB_SUPPORT_API_KEY) {
    console.error('[forms] HUB_SUPPORT_URL/HUB_SUPPORT_API_KEY não configurados');
    return sendJson(res, 503, { ok: false, error: 'Integração com o Hub não configurada.' });
  }

  const externalId = 'site-' + formType + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  const payload = {
    kind: 'request',
    external_id: externalId,
    title: buildTitle(formType, fields),
    description: buildDescription(formType, fields, page),
    priority: priorityForForm(formType),
    module: moduleForForm(formType),
    system: HUB_SUPPORT_SYSTEM_KEY,
    requester: {
      name: String(fields.nome || '').trim().slice(0, 200),
      email: String(fields.email || '').trim().slice(0, 200),
      phone: normalizePhone(fields.whatsapp || fields.telefone || '') || null,
      user_id: 'site:' + formType + ':' + String(fields.email || '').trim().toLowerCase(),
    },
    metadata: {
      form_type: formType,
      page,
      fields,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(HUB_SUPPORT_URL + '/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HUB_SUPPORT_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      const message = (data.error && data.error.message) || data.message || ('Hub respondeu ' + response.status);
      console.error('[forms] falha ao criar chamado no Hub:', message);
      return sendJson(res, 502, { ok: false, error: 'Não foi possível registrar sua solicitação. Tente novamente ou fale no WhatsApp.' });
    }

    const item = data.data || {};
    return sendJson(res, 200, {
      ok: true,
      protocol: item.protocol || null,
      itemId: item.id || null,
      kind: item.kind || 'request',
      message: 'Solicitação registrada no Hub da Nextep.',
    });
  } catch (error) {
    console.error('[forms] erro de conexão com o Hub:', error.message);
    return sendJson(res, 502, { ok: false, error: 'Não foi possível registrar sua solicitação. Tente novamente ou fale no WhatsApp.' });
  } finally {
    clearTimeout(timer);
  }
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

  if (url.pathname === '/api/forms' || url.pathname === '/api/notify') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    return handleForms(req, res);
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
