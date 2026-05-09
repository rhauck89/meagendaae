Implementar as correções e sincronizações solicitadas, focando na integridade financeira, correção de bugs de autenticação e limpeza de dados.

### 1. Limpeza de Dados
- Excluir o usuário `Igorjardel26@gmail.com` da tabela `auth.users` via RPC ou script administrativo para permitir um novo cadastro limpo.

### 2. Sincronização e Banco de Dados (Supabase)
- Aplicar a migration `supabase/migrations/20260509170000_fix_cashback_rpc_return_amount_alias.sql` para garantir que a função `process_appointment_cashback` retorne os campos `amount` e `total_amount` corretamente.
- Deploy da Edge Function `auth-handler` para atualizar a lógica de tratamento de erros e envio de e-mails.

### 3. Ajustes no Frontend e Lógica de Negócio
- **Financeiro**:
    - Atualizar `src/lib/financial-engine.ts` para garantir que `final_price` tenha prioridade sobre `total_price`.
    - Revisar a lógica de deduplicação em `src/pages/Dashboard.tsx` para evitar entradas duplicadas em `company_revenues` ao concluir agendamentos.
- **Comissões e Visões**:
    - Ajustar `src/pages/dashboard/my-finance/commissions.tsx` (ou arquivo equivalente encontrado) para filtrar apenas dados do `professional_id` do usuário logado, mesmo se for admin.
    - Garantir que `src/pages/dashboard/finance/commissions.tsx` mantenha a visão administrativa consolidada.
- **Regras de Comissão**:
    - Ajustar o motor financeiro para tratar "Receita própria" (100% profissional) de forma distinta de comissões, evitando textos confusos na UI como "Sem comissão" em valores integrais.

### 4. Validação e Publicação
- Executar build de produção para garantir que não existam erros de TypeScript.
- Publicar a aplicação.

### Detalhes Técnicos
- **Deduplicação**: Uso de `ON CONFLICT (appointment_id) DO UPDATE` ou verificação prévia de existência de registro para `company_revenues`.
- **UI**: Uso de condicionais para exibir "Receita Própria" em vez de "Sem comissão" quando a taxa de comissão não estiver definida para profissionais independentes.
- **Auth**: Melhoria na captura de erros da Edge Function para exibir mensagens amigáveis em vez de "non-2xx status code".
