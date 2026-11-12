const ALLOWED_ORIGINS = [
  /^https:\/\/nextepsolutions\.vercel\.app$/,
  /^https:\/\/nextepsolutions-[a-z0-9]+-filipe-pires-projects\.vercel\.app$/,
  /^https:\/\/nextepsolutions\.com\.br$/,
  /^https:\/\/www\.nextepsolutions\.com\.br$/,
  /^http:\/\/localhost:\d+$/
];

const FORM_LABELS = {
  contact: 'Contato - Site',
  lead: 'Solicitação de Projeto',
  candidate: 'Candidatura - Vagas'
};

const FIELDS_BY_TYPE = {
  contact: [
    ['nome', 'Nome'], ['empresa', 'Empresa'], ['email', 'E-mail'],
    ['whatsapp', 'WhatsApp'], ['segmento', 'Segmento'], ['servico', 'Serviço'],
    ['orcamento', 'Orçamento'], ['prazo', 'Prazo'], ['descricao', 'Descrição']
  ],
  lead: [
    ['nome', 'Nome'], ['empresa', 'Empresa'], ['email', 'E-mail'],
    ['whatsapp', 'WhatsApp'], ['segmento', 'Segmento'], ['servico', 'Serviço'],
    ['orcamento', 'Orçamento'], ['prazo', 'Prazo'], ['descricao', 'Descrição']
  ],
  candidate: [
    ['nome', 'Nome'], ['email', 'E-mail'], ['whatsapp', 'WhatsApp'],
    ['cidade', 'Cidade/Estado'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'],
    ['portfolio', 'Portfólio'], ['experiencia', 'Experiência'], ['sobre', 'Sobre você'], ['carta', 'Carta']
  ]
};

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

const FORM_RATE_LIMIT_MAX = 3;
const FORM_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MESSAGE = 'Você atingiu o limite de 3 envios por hora. Tente novamente mais tarde ou fale com a gente no WhatsApp.';
const formRateBuckets = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return String(
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    forwarded ||
    req.socket?.remoteAddress ||
    'unknown'
  ).replace(/^::ffff:/, '');
}

function checkFormRateLimit(ip) {
  const now = Date.now();
  const bucket = formRateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    if (bucket) formRateBuckets.delete(ip);
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= FORM_RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

function recordFormSubmission(ip) {
  const now = Date.now();
  const bucket = formRateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    formRateBuckets.set(ip, { count: 1, resetAt: now + FORM_RATE_LIMIT_WINDOW_MS });
  } else {
    bucket.count += 1;
  }

  if (formRateBuckets.size > 5000) {
    for (const [key, value] of formRateBuckets.entries()) {
      if (value.resetAt <= now) formRateBuckets.delete(key);
    }
    if (formRateBuckets.size > 5000) {
      formRateBuckets.delete(formRateBuckets.keys().next().value);
    }
  }
}

async function verifyTurnstile(token, ip) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return { ok: true, skipped: true };
  if (!token) {
    return { ok: false, message: 'Confirme que você não é um robô para enviar o formulário.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const body = new URLSearchParams({ secret, response: String(token), remoteip: ip });
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!data.success) {
      return { ok: false, message: 'Não foi possível validar a verificação de segurança. Tente novamente.' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[forms] falha na verificacao Turnstile:', error.message);
    return { ok: false, message: 'Não foi possível validar a verificação de segurança. Tente novamente.' };
  } finally {
    clearTimeout(timer);
  }
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch {}
  }
  if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const formType = String(body.formType || 'contact');
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const page = String(body.page || '').slice(0, 120);

  if (!fields.nome || !String(fields.nome).trim()) {
    return res.status(400).json({ ok: false, error: 'Informe seu nome.' });
  }
  if (!fields.email || !String(fields.email).trim()) {
    return res.status(400).json({ ok: false, error: 'Informe seu e-mail.' });
  }

  const ip = getClientIp(req);
  const rate = checkFormRateLimit(ip);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter || 3600));
    return res.status(429).json({ ok: false, error: RATE_LIMIT_MESSAGE });
  }

  const turnstile = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstile.ok) {
    return res.status(400).json({ ok: false, error: turnstile.message });
  }

  const hubUrl = String(process.env.HUB_SUPPORT_URL || '').replace(/\/+$/, '');
  const hubKey = process.env.HUB_SUPPORT_API_KEY || '';
  const systemKey = process.env.HUB_SUPPORT_SYSTEM_KEY || 'nextep-site';
  if (!hubUrl || !hubKey) {
    console.error('[forms] HUB_SUPPORT_URL/HUB_SUPPORT_API_KEY não configurados');
    return res.status(503).json({ ok: false, error: 'Integração com o Hub não configurada.' });
  }

  const payload = {
    kind: 'request',
    external_id: 'site-' + formType + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
    title: buildTitle(formType, fields),
    description: buildDescription(formType, fields, page),
    priority: priorityForForm(formType),
    module: moduleForForm(formType),
    system: systemKey,
    requester: {
      name: String(fields.nome || '').trim().slice(0, 200),
      email: String(fields.email || '').trim().slice(0, 200),
      phone: normalizePhone(fields.whatsapp || fields.telefone || '') || null,
      user_id: 'site:' + formType + ':' + String(fields.email || '').trim().toLowerCase()
    },
    metadata: { form_type: formType, page, fields }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(hubUrl + '/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': hubKey },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      const message = (data.error && data.error.message) || data.message || ('Hub respondeu ' + response.status);
      console.error('[forms] falha ao criar chamado no Hub:', message);
      return res.status(502).json({ ok: false, error: 'Não foi possível registrar sua solicitação. Tente novamente ou fale no WhatsApp.' });
    }
    const item = data.data || {};
    recordFormSubmission(ip);
    return res.status(200).json({
      ok: true,
      protocol: item.protocol || null,
      itemId: item.id || null,
      kind: item.kind || 'request'
    });
  } catch (error) {
    console.error('[forms] erro de conexão com o Hub:', error.message);
    return res.status(502).json({ ok: false, error: 'Não foi possível registrar sua solicitação. Tente novamente ou fale no WhatsApp.' });
  } finally {
    clearTimeout(timer);
  }
}
