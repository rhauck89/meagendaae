
# Sistema SaaS de Agendamento Inteligente — MVP

## Visão Geral
Sistema multi-tenant de agendamento para profissionais de estética e barbearia, com agenda inteligente, página pública de booking e webhooks para automação.

## Banco de Dados (Supabase + RLS com company_id)

### Tabelas principais:
- **companies** — dados da empresa (nome, slug, logo, telefone, plano)
- **user_roles** — roles (super_admin, professional, collaborator, client) com company_id
- **profiles** — nome, whatsapp, email, data de nascimento, company_id
- **services** — nome, duração, preço, company_id
- **service_professionals** — relação N:N entre serviços e profissionais
- **business_hours** — horários por dia da semana (início, almoço, retorno, fechamento, company_id)
- **business_exceptions** — feriados, dias fechados, horários especiais
- **appointments** — agendamentos (client_id, professional_id, company_id, datetime, status, valor total)
- **appointment_services** — serviços incluídos em cada agendamento
- **collaborators** — tipo (sócio/comissionado), percentual comissão, company_id
- **waitlist** — lista de espera (client_id, date, service_ids, company_id)
- **webhook_events** — log de eventos disparados (tipo, payload, status)
- **webhook_configs** — URLs de webhook configuradas por empresa e tipo de evento

RLS em todas as tabelas filtrando por company_id via função security definer.

## Autenticação & Onboarding
- Cadastro do profissional → cria company + profile + role "professional"
- Login com email/senha via Supabase Auth
- Após login, redireciona para dashboard da empresa
- Cadastro de cliente na página pública (nome, whatsapp, email, nascimento)

## Páginas & Funcionalidades

### 1. Dashboard do Profissional (`/dashboard`)
- **Calendário** com visualizações dia/semana/mês
- Cada agendamento mostra: cliente, serviço(s), profissional, valor, status (confirmado, cancelado, concluído)
- Ações rápidas: confirmar, cancelar, remarcar

### 2. Cadastro de Serviços (`/dashboard/services`)
- CRUD de serviços com nome, duração, preço
- Vincular profissionais que executam cada serviço
- Ativar/desativar serviços

### 3. Horários de Funcionamento (`/dashboard/settings`)
- Configurar por dia da semana: início, almoço, retorno, fechamento
- Cadastrar exceções: feriados, dias fechados, horários especiais

### 4. Gestão de Equipe (`/dashboard/team`)
- Adicionar colaboradores (sócio ou comissionado)
- Definir percentual de comissão
- Cada colaborador recebe login próprio com role "collaborator"

### 5. Página Pública de Agendamento (`/booking/:slug`)
- Exibe serviços da empresa
- Seleção de múltiplos serviços (duração total = soma)
- Escolha de profissional
- **Agenda inteligente**: calcula horários disponíveis baseado em horário de funcionamento + duração + agendamentos existentes
- Cliente cria conta ou usa sessão salva
- Confirmação com resumo (serviços, profissional, horário, valor)

### 6. Área do Cliente (`/my-appointments`)
- Lista agendamentos futuros e passados
- Botões de cancelar e reagendar
- Ativar lista de espera quando agenda cheia

### 7. Relatórios (`/dashboard/reports`)
- Faturamento diário, semanal, mensal
- Filtro por profissional
- Resumo de comissões

### 8. Webhooks & Automações (`/dashboard/automations`)
- Configurar URLs de webhook por tipo de evento
- Eventos: appointment_created, appointment_cancelled, appointment_reminder, client_return_due, birthday_message, slot_available
- Testar disparo de webhook

### 9. Painel Super Admin (`/admin`)
- Lista de empresas cadastradas
- Status de assinatura (ativo/inativo/bloqueado)
- Receita mensal total
- Bloquear/desbloquear contas

## Lógica de Negócio (Edge Functions)

- **Cálculo de horários disponíveis**: função que recebe company_id, data, serviços selecionados e retorna slots livres
- **Disparo de webhooks**: Edge Function que processa eventos e envia para URLs configuradas
- **Lista de espera**: quando agendamento é cancelado, notifica clientes na waitlist via webhook
- **Inteligência de retorno**: analisa histórico e dispara client_return_due quando cliente ultrapassa frequência média

## Pagamentos (Stripe)
- Assinatura mensal única para profissionais
- Checkout via Stripe
- Webhook do Stripe para atualizar status da assinatura
- Bloqueio de acesso quando assinatura expira

## Design
- Interface limpa e moderna com Tailwind/shadcn
- Sidebar de navegação no dashboard
- Responsivo para uso mobile pelos profissionais
- Página pública de booking otimizada para mobile (clientes agendam pelo celular)
