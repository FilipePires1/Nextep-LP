const ALLOWED_ORIGINS = [
  /^https:\/\/nextepsolutions\.vercel\.app$/,
  /^https:\/\/nextepsolutions-[a-z0-9]+-filipe-pires-projects\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/
];

const FORM_LABELS = {
  contact: 'Contato - Site',
  lead: 'Solicitação de Projeto',
  candidate: 'Candidatura - Vagas'
};

const FIELDS_BY_TYPE = {
  contact: [
    ['nome', '👤 Nome'],
    ['empresa', '🏢 Empresa'],
    ['email', '📧 E-mail'],
    ['whatsapp', '📱 WhatsApp'],
    ['segmento', '🎯 Segmento'],
    ['servico', '🛠 Serviço'],
    ['orcamento', '💰 Orçamento'],
    ['prazo', '⏰ Prazo'],
    ['descricao', '📝 Descrição']
  ],
  candidate: [
    ['nome', '👤 Nome'],
    ['email', '📧 E-mail'],
    ['whatsapp', '📱 WhatsApp'],
    ['cidade', '📍 Cidade/Estado'],
    ['linkedin', '💼 LinkedIn'],
    ['github', '🐙 GitHub'],
    ['portfolio', '🔗 Portfólio'],
    ['experiencia', '📝 Experiência'],
    ['sobre', '🙋 Sobre você'],
    ['carta', '✉️ Carta']
  ]
};

function buildMessage(formType, fields, page) {
  const title = FORM_LABELS[formType] || 'Formulário - Site';
  const lines = ['📋 *Novo formulário: ' + title + '*'];
  const pairs = FIELDS_BY_TYPE[formType] || [];
  for (const [key, label] of pairs) {
    const raw = fields[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).replace(/\s+/g, ' ').trim();
    if (!value) continue;
    const clipped = value.length > 400 ? value.slice(0, 400) + '…' : value;
    lines.push(label + ': ' + clipped);
  }
  if (page) lines.push('🌐 Página: ' + page);
  lines.push('🕐 ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  return lines.join('\n');
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

async function sendWhatsApp(phone, apikey, text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const url =
      'https://api.callmebot.com/whatsapp.php?phone=' +
      encodeURIComponent('+' + phone) +
      '&text=' +
      encodeURIComponent(text) +
      '&apikey=' +
      encodeURIComponent(apikey);
    const res = await fetch(url, { signal: controller.signal });
    return res.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {}
  }
  if (!ALLOWED_ORIGINS.some(re => re.test(origin))) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body && typeof body === 'object' ? body : {};

  const formType = String(body.formType || '');
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const page = String(body.page || '').slice(0, 120);

  const recipients = [
    { phone: process.env.WA_OWNER_PHONE, apikey: process.env.WA_OWNER_APIKEY },
    { phone: process.env.WA_SALES_PHONE, apikey: process.env.WA_SALES_APIKEY }
  ].filter(r => r.phone && r.apikey);

  if (recipients.length === 0) {
    return res.status(200).json({ ok: true, skipped: 'not configured' });
  }

  const text = buildMessage(formType, fields, page);
  const results = await Promise.allSettled(
    recipients.map(r => sendWhatsApp(normalizePhone(r.phone), r.apikey, text))
  );
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
  return res.status(200).json({ ok: true, sent, total: recipients.length });
}
