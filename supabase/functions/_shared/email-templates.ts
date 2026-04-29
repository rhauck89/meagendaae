
/**
 * Layout base para os e-mails da Agendaê
 */
export const getEmailLayout = (content: string, previewText?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agendaê</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #ffffff;
      padding: 30px;
      text-align: center;
      border-bottom: 1px solid #f0f0f0;
    }
    .header img {
      max-width: 180px;
      height: auto;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #f0f0f0;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #000000;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin-top: 25px;
    }
    .preview-text {
      display: none;
      max-height: 0px;
      overflow: hidden;
    }
    h1 { color: #111827; font-size: 24px; margin-bottom: 20px; }
    p { margin-bottom: 15px; }
  </style>
</head>
<body>
  ${previewText ? `<div class="preview-text">${previewText}</div>` : ''}
  <div class="container">
    <div class="header">
      <img src="https://fbujndjmainizgmligxt.supabase.co/storage/v1/object/public/email-assets/meagendaae-fundo-claro.png" alt="Agendaê">
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Agendaê - Sua agenda inteligente</p>
      <p><a href="https://meagendae.com.br" style="color: #6b7280; text-decoration: underline;">meagendae.com.br</a></p>
      <p style="margin-top: 10px; font-style: italic;">Este é um e-mail automático. Não responda esta mensagem.</p>
    </div>
  </div>
</body>
</html>
`;

export const templates = {
  company_welcome: (data: { name: string }) => ({
    subject: "Bem-vindo à Agendaê! 🚀",
    html: getEmailLayout(`
      <h1>Olá, ${data.name}!</h1>
      <p>Seja muito bem-vindo à Agendaê. Estamos muito felizes em ter você conosco.</p>
      <p>Sua conta foi criada com sucesso e você já pode começar a organizar sua agenda de forma inteligente.</p>
      <a href="https://app.meagendae.com.br/dashboard" class="button">Acessar meu Dashboard</a>
    `, "Seja bem-vindo à Agendaê!")
  }),
  
  ticket_created: (data: { protocol: string, title: string }) => ({
    subject: `Ticket Recebido: ${data.protocol}`,
    html: getEmailLayout(`
      <h1>Recebemos seu ticket!</h1>
      <p>Olá, recebemos sua solicitação de suporte e nossa equipe já está analisando.</p>
      <p><strong>Protocolo:</strong> ${data.protocol}</p>
      <p><strong>Assunto:</strong> ${data.title}</p>
      <p>Responderemos em breve através da nossa plataforma.</p>
      <a href="https://app.meagendae.com.br/support" class="button">Ver meu Ticket</a>
    `, `Seu ticket ${data.protocol} foi criado com sucesso.`)
  }),

  ticket_replied: (data: { protocol: string, message: string }) => ({
    subject: `Nova resposta no Ticket: ${data.protocol}`,
    html: getEmailLayout(`
      <h1>Nova resposta do suporte!</h1>
      <p>Nossa equipe respondeu ao seu ticket <strong>${data.protocol}</strong>.</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
        ${data.message}
      </div>
      <a href="https://app.meagendae.com.br/support" class="button">Responder suporte</a>
    `, "Você tem uma nova resposta no seu ticket de suporte.")
  }),

  subscription_success: (data: { plan_name: string }) => ({
    subject: "Pagamento Confirmado! 💳",
    html: getEmailLayout(`
      <h1>Tudo certo com sua assinatura!</h1>
      <p>Seu pagamento foi aprovado e seu plano <strong>${data.plan_name}</strong> está ativo.</p>
      <p>Aproveite todos os recursos premium da Agendaê.</p>
      <a href="https://app.meagendae.com.br/settings/subscription" class="button">Ver minha assinatura</a>
    `, "Sua assinatura foi confirmada com sucesso.")
  }),

  payment_failed: (data: { plan_name: string }) => ({
    subject: "Problema no pagamento ⚠️",
    html: getEmailLayout(`
      <h1>Ops! Tivemos um problema.</h1>
      <p>Não conseguimos processar o pagamento do seu plano <strong>${data.plan_name}</strong>.</p>
      <p>Para evitar a suspensão dos seus serviços, por favor verifique seus dados de pagamento.</p>
      <a href="https://app.meagendae.com.br/settings/subscription" class="button">Atualizar pagamento</a>
    `, "Houve um problema ao processar seu pagamento.")
  })
};
