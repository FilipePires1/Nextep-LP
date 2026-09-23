/**
 * Google Apps Script para receber formulários da NexTep
 * 
 * INSTRUÇÕES DE SETUP:
 * 1. Acesse https://script.google.com/
 * 2. Novo Projeto → Cole este código
 * 3. Crie uma planilha no Google Sheets (ou use uma existente)
 * 4. Copie o ID da planilha (da URL: https://docs.google.com/spreadsheets/d/ID_DA_PLANILHA/edit)
 * 5. Substitua SPREADSHEET_ID abaixo
 * 6. Ajuste EMAIL_REMETENTE se quiser outro e-mail "De:"
 * 7. Deploy → Nova implantação → Tipo: "Aplicativo da Web"
 *    - Execute como: Eu
 *    - Quem tem acesso: Qualquer pessoa
 * 8. Copie a URL do web app e me dê para eu colocar no site
 */

// ===== CONFIGURAÇÕES =====
const SPREADSHEET_ID = 'SEU_SPREADSHEET_ID_AQUI';  // ← SUBSTITUA AQUI
const SHEET_NAME = 'Formulários';                    // Nome da aba
const EMAIL_REMETENTE = 'nextep.solutionsorg@gmail.com';  // E-mail que envia a confirmação
const EMAIL_ASSUNTO_PREFIXO = '[NexTep] ';

// Tipos de formulário e seus rótulos
const FORM_LABELS = {
  contact: 'Contato - Página Contato',
  lead: 'Solicitação de Projeto',
  candidate: 'Candidatura - Vagas/Carreiras',
  partner: 'Proposta de Parceria',
  unknown: 'Outro'
};

// ===== FUNÇÃO PRINCIPAL (recebe POST) =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data._type || 'unknown';
    const timestamp = data._timestamp || new Date().toISOString();
    const page = data._page || 'desconhecida';
    
    // Remove metadados internos antes de gravar
    const { _type, _timestamp, _page, ...formData } = data;
    
    // Grava na planilha
    appendToSheet(type, timestamp, page, formData);
    
    // Envia e-mail de confirmação para o usuário
    sendConfirmationEmail(type, formData);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    console.error('Erro no doPost:', err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== GRAVA NA PLANILHA =====
function appendToSheet(type, timestamp, page, formData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Cabeçalhos
    sheet.appendRow([
      'Data/Hora',
      'Tipo de Formulário',
      'Página de Origem',
      'Nome',
      'Empresa',
      'E-mail',
      'WhatsApp',
      'Segmento',
      'Serviço de Interesse',
      'Orçamento',
      'Prazo',
      'Descrição / Proposta',
      'Portfólio / LinkedIn / Site',
      'Dados Brutos (JSON)'
    ]);
    // Formata cabeçalho
    sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#3B82F6').setFontColor('#FFFFFF');
  }
  
  const row = [
    new Date(timestamp),
    FORM_LABELS[type] || type,
    page,
    formData.nome || '',
    formData.empresa || '',
    formData.email || '',
    formData.whatsapp || '',
    formData.segmento || '',
    formData.servico || '',
    formData.orcamento || '',
    formData.prazo || '',
    formData.descricao || formData.proposta || '',
    formData.portfolio || formData.site || formData.linkedin || '',
    JSON.stringify(formData)
  ];
  
  sheet.appendRow(row);
  
  // Auto-largura nas colunas principais
  sheet.autoResizeColumns(1, 8);
}

// ===== ENVIA E-MAIL DE CONFIRMAÇÃO PARA O USUÁRIO =====
function sendConfirmationEmail(type, formData) {
  const userEmail = formData.email;
  if (!userEmail || !userEmail.includes('@')) return; // Sem e-mail válido
  
  const userName = formData.nome || 'Prezado(a)';
  const label = FORM_LABELS[type] || 'formulário';
  
  const subject = `${EMAIL_ASSUNTO_PREFIXO}Recebemos seu ${label.toLowerCase()}`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #0A0A0F; color: #fff; padding: 32px 24px; text-align: center; }
    .header img { height: 40px; margin-bottom: 12px; }
    .header h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .content { padding: 32px 24px; }
    .badge { display: inline-block; background: #3B82F6; color: #fff; padding: 6px 16px; border-radius: 100px; font-size: 0.8rem; font-weight: 600; margin-bottom: 16px; }
    .details { background: #fafafa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { margin: 8px 0; }
    .detail-label { font-weight: 600; color: #666; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .detail-value { color: #111; }
    .footer { background: #fafafa; padding: 24px; text-align: center; border-top: 1px solid #eee; font-size: 0.85rem; color: #888; }
    .footer a { color: #3B82F6; text-decoration: none; }
    .btn { display: inline-block; background: #3B82F6; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://nextepsolutions.vercel.app/Logos%20-%20Imagens/Nextep/Logo%20Reduzida%20Branca.png" alt="NexTep Solutions" onerror="this.style.display='none'">
      <h1>NexTep Solutions</h1>
    </div>
    <div class="content">
      <span class="badge">${label}</span>
      <p>Olá <strong>${userName}</strong>,</p>
      <p>Recebemos sua mensagem via <strong>${label}</strong>. Nossa equipe vai analisar e retornar em até <strong>24 horas úteis</strong>.</p>
      
      <div class="details">
        <div class="detail-row">
          <div class="detail-label">Tipo</div>
          <div class="detail-value">${label}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Enviado em</div>
          <div class="detail-value">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
        </div>
        ${formData.empresa ? `
        <div class="detail-row">
          <div class="detail-label">Empresa</div>
          <div class="detail-value">${formData.empresa}</div>
        </div>` : ''}
        ${formData.servico ? `
        <div class="detail-row">
          <div class="detail-label">Serviço de interesse</div>
          <div class="detail-value">${formData.servico}</div>
        </div>` : ''}
        ${formData.orcamento ? `
        <div class="detail-row">
          <div class="detail-label">Orçamento indicado</div>
          <div class="detail-value">${formData.orcamento}</div>
        </div>` : ''}
      </div>
      
      <p>Se precisar adicionar algo, basta responder este e-mail.</p>
      
      <a href="https://nextepsolutions.vercel.app/contato/" class="btn">Falar no WhatsApp</a>
    </div>
    <div class="footer">
      <p>NexTep Solutions — Tecnologia, automação e soluções digitais</p>
      <p>
        <a href="https://wa.me/5531999657698">WhatsApp</a> · 
        <a href="mailto:nextep.solutionsorg@gmail.com">E-mail</a> · 
        <a href="https://nextepsolutions.vercel.app/">Site</a>
      </p>
      <p style="margin-top:12px;font-size:0.75rem">Este é um e-mail automático, não responda diretamente se não quiser que vá para a caixa de entrada da equipe.</p>
    </div>
  </div>
</body>
</html>`;
  
  const textBody = `
Olá ${userName},

Recebemos sua mensagem via ${label}. Nossa equipe vai analisar e retornar em até 24 horas úteis.

Detalhes:
- Tipo: ${label}
- Enviado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
${formData.empresa ? `- Empresa: ${formData.empresa}` : ''}
${formData.servico ? `- Serviço de interesse: ${formData.servico}` : ''}
${formData.orcamento ? `- Orçamento indicado: ${formData.orcamento}` : ''}

Se precisar adicionar algo, responda este e-mail.

--
NexTep Solutions
WhatsApp: (31) 99965-7698
E-mail: nextep.solutionsorg@gmail.com
Site: https://nextepsolutions.vercel.app
`;
  
  MailApp.sendEmail({
    to: userEmail,
    subject: subject,
    htmlBody: htmlBody,
    body: textBody,
    name: 'NexTep Solutions',
    noReply: false // permite resposta
  });
}

// ===== TESTE MANUAL (rode no editor do Apps Script) =====
function testar() {
  const testData = {
    _type: 'contact',
    _timestamp: new Date().toISOString(),
    _page: '/contato/',
    nome: 'Teste Usuario',
    empresa: 'Empresa Teste',
    email: 'teste@exemplo.com',  // ← COLOQUE SEU E-MAIL REAL PARA TESTAR
    whatsapp: '31 99999-9999',
    segmento: 'Tecnologia',
    servico: 'Site',
    orcamento: 'R$ 5.000 — R$ 15.000',
    prazo: 'Até 30 dias',
    descricao: 'Teste de integração Google Sheets + E-mail'
  };
  doPost({ postData: { contents: JSON.stringify(testData) } });
  Logger.log('Teste enviado! Verifique a planilha e seu e-mail.');
}