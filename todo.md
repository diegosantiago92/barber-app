# Project TODO

## Core App (v1)
- [x] Configurar paleta de cores (theme.config.js)
- [x] Definir schema do banco de dados (serviços, horários de funcionamento, agendamentos)
- [x] Criar queries do banco de dados (server/db.ts)
- [x] Criar rotas tRPC da API (server/routers.ts)
- [x] Configurar mapeamento de ícones (icon-symbol.tsx)
- [x] Implementar tela de Login
- [x] Implementar tela Home (cliente)
- [x] Implementar tela de Agendamento (seleção de serviço, data, horário)
- [x] Implementar tela Meus Agendamentos (próximos + histórico)
- [x] Implementar Painel Admin (visão do dia, estatísticas)
- [x] Implementar Gerenciar Horários (admin)
- [x] Implementar Gerenciar Serviços (admin)
- [x] Implementar tela de Perfil
- [x] Implementar navegação condicional (admin vs cliente)
- [x] Bloqueio de agendamento retroativo (datas passadas)
- [x] Sistema de notificação push local (lembrete 1h antes)
- [x] Ações na notificação (confirmar/cancelar)
- [x] Notificação ao owner quando novo agendamento é criado
- [x] Gerar logo do app
- [x] Rodar migrações do banco de dados
- [x] Testes e validação (13 testes passando)

## Multi-tenant + SaaS (v2)
- [x] Adicionar tabela barbershops no schema (nome, slug, logo, endereço, telefone)
- [x] Adicionar coluna barbershopId em services, working_hours, blocked_dates, appointments
- [x] Adicionar tabela barbershop_members (usuário ↔ barbearia, role: owner/admin/client)
- [x] Adicionar campo subscriptionStatus (active/blocked/trial) na tabela barbershops
- [x] Adicionar role superadmin na tabela users
- [x] Atualizar todas as queries do db.ts para filtrar por barbershopId
- [x] Atualizar todas as rotas da API para exigir contexto de barbearia
- [x] Contexto global de barbearia ativa (BarbershopProvider)
- [x] Tela de seleção de barbearia (cliente escolhe qual barbearia quer agendar)
- [x] Tela de criação de barbearia (onboarding do owner)
- [x] Isolamento total: admin só vê dados da sua barbearia
- [x] Clientes só veem agendamentos da barbearia selecionada
- [x] Painel Super-Admin: listar todas as barbearias com estatísticas
- [x] Painel Super-Admin: bloquear/ativar/trial acesso de uma barbearia
- [x] Painel Super-Admin: adicionar admin a uma barbearia por e-mail
- [x] Bloqueio de acesso quando subscriptionStatus = blocked
- [x] Tela de acesso bloqueado para admin da barbearia bloqueada
- [x] Link para Super-Admin no Perfil (apenas para superadmin)
- [x] Registrar rotas super-admin e barbershop-select no _layout.tsx
- [x] Migração do banco aplicada (7 tabelas criadas)
- [x] Zero erros de TypeScript
- [x] 13 testes passando
