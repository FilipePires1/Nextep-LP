/**
 * ============================================
 *  NexTep Solutions — Formulários → Google Sheets
 * ============================================
 * 
 * COMO USAR:
 * 1. Abra https://sheets.google.com e crie uma planilha nova
 * 2. Clique em "Extensões" > "Apps Script"
 * 3. Apague tudo que estiver lá e cole ESTE CÓDIGO inteiro
 * 4. Na linha 10, troque SEU_SPREADSHEET_ID pelo ID da planilha
 *    (pegue da URL: docs.google.com/spreadsheets/d/ **ID_AQUI** /edit)
 * 5. Clique em "Implantar" > "Nova implantação"
 * 6. Ícone de engrenagem > "Aplicativo da Web"
 * 7. Execute como: "Eu" | Acesso: "Qualquer pessoa"
 * 8. Clique "Implantar" e copie a URL gerada
 * 9. Cole essa URL no arquivo script.js do site (linha: COLE_AQUI_A_URL...)
 * 10. Teste: no editor, selecione "testar" e clique ▶ Executar
 */

// ===== CONFIGURAÇÃO =====
const SPREADSHEET_ID = 'SEU_SPREADSHEET_ID_AQUI';
const SHEET_NAME = 'Formulários';

// ===== NÃO MEXA ABAIXO =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data._type || 'desconhecido';
    const page = data._page || '';
    const timestamp = data._timestamp || new Date().toISOString();

    // Rótulos por tipo
    const labels = {
      contact: 'Contato',
      lead: 'Solicitação de Projeto',
      candidate: 'Candidatura',
      partner: 'Parceria',
      unknown: 'Desconhecido'
    };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Cria a aba se não existir
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Data/Hora', 'Tipo', 'Página', 'Nome', 'Empresa', 'E-mail', 'WhatsApp', 'Segmento', 'Serviço', 'Orçamento', 'Prazo', 'Descrição', 'Portfólio/Link']);
      sheet.getRange(1, 1, 1, 13)
        .setFontWeight('bold')
        .setBackground('#3B82F6')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }

    // Grava a linha
    sheet.appendRow([
      new Date(timestamp),
      labels[type] || type,
      page,
      data.nome || '',
      data.empresa || '',
      data.email || '',
      data.whatsapp || '',
      data.segmento || '',
      data.servico || '',
      data.orcamento || '',
      data.prazo || '',
      data.descricao || data.proposta || '',
      data.portfolio || data.site || data.linkedin || ''
    ]);

    // Envia e-mail de confirmação para quem preencheu
    if (data.email && data.email.indexOf('@') > 0) {
      enviarConfirmacao(data, labels[type] || type);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== E-MAIL DE CONFIRMAÇÃO =====
function enviarConfirmacao(data, tipoLabel) {
  const assunto = '[NexTep] Recebemos seu ' + tipoLabel.toLowerCase();

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#0A0A0F;color:#fff;padding:32px 24px;text-align:center">
      <h1 style="margin:0;font-size:1.4rem">NexTep Solutions</h1>
    </div>
    <div style="padding:32px 24px">
      <span style="display:inline-block;background:#3B82F6;color:#fff;padding:5px 14px;border-radius:100px;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">${tipoLabel}</span>
      <p style="font-size:1rem;color:#333">Olá <strong>${data.nome || ''}</strong>,</p>
      <p style="font-size:.95rem;color:#555;line-height:1.6">Recebemos sua mensagem. Nossa equipe vai analisar e retornar em até <strong>24 horas úteis</strong>.</p>
      <div style="background:#f7f7f7;border-radius:8px;padding:20px;margin:20px 0;font-size:.9rem;color:#444">
        <strong>Tipo:</strong> ${tipoLabel}<br>
        ${data.empresa ? `<strong>Empresa:</strong> ${data.empresa}<br>` : ''}
        ${data.servico ? `<strong>Serviço:</strong> ${data.servico}<br>` : ''}
        ${data.orcamento ? `<strong>Orçamento:</strong> ${data.orcamento}<br>` : ''}
        <strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}
      </div>
      <p style="font-size:.95rem;color:#555">Se precisar adicionar algo, basta responder este e-mail.</p>
      <a href="https://wa.me/5531999657698" style="display:inline-block;background:#3B82F6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px">Falar no WhatsApp</a>
    </div>
    <div style="background:#f7f7f7;padding:20px;text-align:center;font-size:.8rem;color:#999">
      NexTep Solutions — Tecnologia, automação e soluções digitais<br>
      <a href="mailto:nextep.solutionsorg@gmail.com" style="color:#3B82F6">nextep.solutionsorg@gmail.com</a>
    </div>
  </div>`;

  MailApp.sendEmail({
    to: data.email,
    subject: assunto,
    htmlBody: html,
    name: 'NexTep Solutions'
  });
}

// ===== TESTE =====
function testar() {
  doPost({ postData: { contents: JSON.stringify({
    _type: 'contact',
    _page: '/contato/',
    _timestamp: new Date().toISOString(),
    nome: 'Teste',
    email: 'SEU_EMAIL_AQUI@teste.com',
    descricao: 'Teste de integração'
  })}});
  Logger.log('Teste enviado! Verifique a planilha e o e-mail.');
}