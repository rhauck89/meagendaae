The user wants to fix encoding issues (mojibake) in the frontend strings, specifically in the Team page and the sidebar. 

### Proposed Changes

#### 1. Sidebar/Navigation (src/components/DashboardLayout.tsx)
*   Fix `ConfiguraÃ§Ãµes` to `Configurações` in both the label strings and the breadcrumb logic.

#### 2. Team Page (src/pages/Team.tsx)
*   Fix `FuncionÃ¡rio` to `Funcionário` in `SYSTEM_ROLES`.
*   Fix encoding in `handleAdd` error toast (`Empresa nÃ£o encontrada` -> `Empresa não encontrada`).
*   Fix encoding in `handleSendInvite` error toast (`Email nÃ£o encontrado` -> `Email não encontrado`) and success toast (`Credenciais temporÃ¡rias geradas!` -> `Credenciais temporárias geradas!`).
*   Fix encoding in `handleResetPassword` error toast (`Email nÃ£o encontrado` -> `Email não encontrado`) and success toast (`Email de redefiniÃ§Ã£o de senha enviado!` -> `Email de redefinição de senha enviado!`).
*   Fix `openEditDialog` comment fallback (`silent â€” fallback to empty` -> `silent — fallback to empty`).
*   Fix encoding in `toggleEditService` error toast (`Erro ao atualizar serviÃ§o` -> `Erro ao atualizar serviço`).
*   Fix encoding in `saveEditSlug` error toast (`Identificador invÃ¡lido` -> `Identificador inválido`).
*   Fix encoding in `handleSaveEdit` error toast (`Nome Ã© obrigatÃ³rio` -> `Nome é obrigatório`).
*   Fix encoding in `handleDeleteConfirmed` success toast (`Profissional excluÃ­do` -> `Profissional excluído`).
*   Fix encoding in `handleSaveAbsence` error toasts (`Defina as datas de inÃ­cio e fim` -> `Defina as datas de início e fim`, `Data de inÃ­cio deve ser antes da data de fim` -> `Data de início deve ser antes da data de fim`) and success toast (`AusÃªncia configurada!` -> `Ausência configurada!`).
*   Fix encoding in `handleRemoveAbsence` success toast (`AusÃªncia removida!` -> `Ausência removida!`) and error toast (`Erro ao remover ausÃªncia` -> `Erro ao remover ausência`).
*   Fix `absenceTypeLabel` mapping (`FÃ©rias` -> `Férias`).
*   Fix `paymentLabel` mapping (`Receita prÃ³pria` -> `Receita própria`, `serviÃ§o` -> `serviço`).
*   Fix `renderCollaboratorCard` aria-label (`Mais opÃ§Ãµes` -> `Mais opções`).
*   Fix `DropdownMenuLabel` for Public Page (`PÃ¡gina pÃºblica` -> `Página pública`).
*   Fix dropdown items for Public Page (`Abrir pÃ¡gina` -> `Abrir página`).
*   Fix `DropdownMenuLabel` for Absence (`AusÃªncia` -> `Ausência`).
*   Fix dropdown items for Absence (`Remover ausÃªncia` -> `Remover ausência`, `Definir ausÃªncia` -> `Definir ausência`).
*   Fix `PrÃ³ximo` label and handle the empty state for next appointment (`â€”` -> `Sem horário`).
*   Fix `todayCount` plural label (`atendimentos` -> `atendimentos` is already correct but checking context).
*   Fix "Disable Professional" dialog text:
    *   Title: `Desabilitar profissional?` (correct).
    *   Description: `O profissional nÃ£o aparecerÃ¡ na agenda, nÃ£o poderÃ¡ receber novos agendamentos e ficarÃ¡ oculto na pÃ¡gina pÃºblica. O histÃ³rico serÃ¡ mantido.` -> `O profissional não aparecerá na agenda, não poderá receber novos agendamentos e ficará oculto na página pública. O histórico será mantido.`
*   Fix "Cannot Delete" dialog text:
    *   Title: `NÃ£o Ã© possÃ­vel excluir` -> `Não é possível excluir`.
    *   Description: `Este profissional nÃ£o pode ser excluÃ­do porque jÃ¡ possui registros no sistema. Para manter a integridade dos relatÃ³rios e histÃ³rico financeiro, utilize a opÃ§Ã£o "Desabilitar profissional".` -> `Este profissional não pode ser excluído porque já possui registros no sistema. Para manter a integridade dos relatórios e histórico financeiro, utilize a opção "Desabilitar profissional".`
*   Fix "Delete Confirmation" dialog text:
    *   Description: `Esta aÃ§Ã£o nÃ£o pode ser desfeita. O profissional serÃ¡ removido permanentemente do sistema.` -> `Esta ação não pode ser desfeita. O profissional será removido permanentemente do sistema.`
*   Fix "Invite Credentials" dialog texts (`Senha temporÃ¡ria` -> `Senha temporária`, `apÃ³s o primeiro login` -> `após o primeiro login`).
*   Fix "Absence Dialog" texts (`Definir AusÃªncia` -> `Definir Ausência`, `Tipo de ausÃªncia` -> `Tipo de ausência`, `FÃ©rias` -> `Férias`, `Data de inÃ­cio` -> `Data de início`).
*   Fix "Wizard Step 4" texts (`ConfiguraÃ§Ã£o visual` -> `Configuração visual`, `usarÃ¡ o banner` -> `usará o banner`, `perfil pÃºblico` -> `perfil público`, `poderÃ¡ definir` -> `poderá definir`, `ServiÃ§os` -> `Serviços`, `disponÃ­veis` -> `disponíveis`, `selecionados` -> `selecionados`, `serviÃ§o cadastrado` -> `serviço cadastrado`, `VocÃª pode` -> `Você pode`, `R$ ... â€¢` -> `R$ ... —`, `PrÃ³ximo` -> `Próximo`).
*   Fix "Wizard Step 5" texts (`VÃ­nculo` -> `Vínculo`, `RemuneraÃ§Ã£o` -> `Remuneração`, `serviÃ§o` -> `serviço`, `ParticipaÃ§Ã£o` -> `Participação`, `PadrÃ£o da empresa` -> `Padrão da empresa`).
*   Fix "Empty State" text (`comeÃ§ar a agendar` -> `começar a agendar`).

#### 3. Business Model Library (src/lib/business-model.ts)
*   Fix `serviÃ§o` to `serviço` in `modelBadgeLabel`.

### Technical Details
*   Perform global search and replace for specific broken patterns in the identified files.
*   Ensure that the replacement for `â€”` (em dash) is the correct character `—` or the requested text `Sem horário` in the "Próximo" column.

### Verification
*   Run `npm run build` to ensure no syntax errors were introduced.
*   Manual review of the modified files to ensure all strings were corrected.
