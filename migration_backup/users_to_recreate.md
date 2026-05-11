# Usuários para recriar no Supabase externo

Para manter o funcionamento do sistema, você deve criar manualmente estes usuários no seu novo projeto Supabase (Authentication -> Users).

| Email | ID Original (UUID) | Nome |
| :--- | :--- | :--- |
| rafaelcosta@gmail.com | 41373e3e-1aaf-4bfa-988c-0e5bc4979150 | Rafael Costa |
| clubenafaixaoficial@gmail.com | aad7a233-64ab-4f21-b648-2058c922a4ba | Carlos Andrade |
| nathalia@vemserup.com.br | 02503cd1-f80f-4e21-9f92-504abb674d7c | Nathalia Martins |
| testemembro@gmail.com | 35291e71-3501-465e-807e-e384dc38a72f | membro teste |
| lucasalmeida@gmail.com | b5ec00ef-042b-41c1-9e9c-0590dfb8c08d | Lucas Almeida |
| teste@email.com | fe49d72c-b099-486a-b9a5-79e3e681f48d | Teste |
| phaelsd@gmail.com | 5d6a5d58-bfaa-4808-9058-08126aa36b20 | Raphael Hauck |
| matheusoliveira@gmail.com | 9aab8227-c5cd-4faf-a519-4e0a68e365ae | Matheus Oliveira |
| grow@vemserup.com.br | 0432e7de-5281-4eeb-b060-1f37514d04b4 | Raphael Hauck |
| codex-live-5b87c5c2@example.com | 548db8e0-ef6d-4ade-889a-ed1cf1b28adb | Codex Live |
| codex-test-5b2918d1@example.com | da9ed9bb-9de8-45d2-849d-1edae0f4f41e | Codex Teste |
| cristianocampos.sd@gmail.com | 126c9b6d-ff93-4488-8113-a2cfee6f03fe | Cristiano Campos Ferreira |
| codex-test-9dff939b@example.com | ed60bf68-5f81-412a-bcff-4015785104b2 | Codex Teste |
| meagendae@gmail.com | 56314174-1818-4884-9062-d8836ed3fcf1 | Cristiano Campos Coelho |

**Importante:** Se o seu projeto de destino já tiver usuários, verifique se não há conflitos de e-mail. Para que as tabelas `profiles`, `collaborators`, etc., funcionem corretamente, os usuários no `auth.users` precisam ter exatamente os mesmos UUIDs acima. Se você não puder definir o UUID manualmente na criação via interface do Supabase, será necessário um script SQL de INSERT na tabela `auth.users` (não recomendado sem permissões de superusuário) ou atualizar os IDs nas tabelas públicas após a criação.
