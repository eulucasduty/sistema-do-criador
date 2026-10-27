@AGENTS.md

# Creaty

Sistema instalável de criação de conteúdo para um criador. Sem WhatsApp, disparos ou agentes de atendimento.

- `app/(painel)/page.tsx`: início com estado da instalação; `/guia` contém o guia.
- `app/(painel)/referencias`: análise, persona e criação na identidade do perfil.
- `app/(painel)/esteira`: produção de reels e carrosséis.
- `lib/roteiro`, `lib/monitor`, `lib/carrossel`, `lib/postagem`, `lib/entregas`: conteúdo e publicação.
- `app/teleprompter`, `app/gravar`: ensaio e gravação.
- `app/m/[slug]`: material público somente quando pronto e publicado.
- `lib/instagram`: API e automações determinísticas; não chamar IA para atender leads.
- `lib/relogio.ts`: cron da hospedagem ou laço numa VPS.
- `scripts/estacao-edicao.mjs`, `scripts/estacao-roteiros.ts`, `scripts/estacao-carrosseis.ts`: processos locais independentes, autenticados pela sessão do dono e RLS.
- `editor/` e `carrosseis/kit`: produção; resultados e caches fora do Git.
- `supabase/migrations`: banco no schema `public`, autorização em `criador_privado`.

Regras:

- Identidade vem de `lib/config.ts`: nunca fixar @, nicho, foto, oferta ou link da operação.
- Chaves no ambiente ou na tabela de segredos; nunca no código ou nos prompts.
- Ações com cliente secreto ou gasto de IA chamam `exigirEquipe()`.
- Arquivos grandes vão do navegador direto ao Storage por URL assinada.
- Preserve o estilo Arena: escuro/claro, amarelo, tipografia, bordas e sombras marcadas.
- Não altere a migração 001 publicada. Crie migrações novas.
- Valide com typecheck, lint, build e testes apropriados. Publicar em conta real exige as conexões da instalação.
