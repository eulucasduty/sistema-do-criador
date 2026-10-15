@AGENTS.md

# Creator System

Sistema de produção de conteúdo de UM criador do Instagram: Esteira de referências (análise, cópia de carrossel), roteiros pra teleprompter na voz dele, editor de vídeo com IA (roda no PC dele com o Claude Code), automações do Instagram (comentário → DM) e um agente de IA opcional no direct.

## Estrutura

- `app/(painel)/` — o painel (logado). `page.tsx` é o Início com o passo a passo de instalação (status ao vivo via `lib/passos.ts`).
- `app/api/webhooks/instagram` — webhook da Meta (comentários, DMs, botões). `app/api/relogio` — a batida do relógio (o Supabase chama a cada minuto via pg_cron). `app/r/[codigo]` — link rastreado das DMs.
- `lib/instagram/` — cliente da API (`api.ts`), o motor das automações (`receber.ts`), envio registrado (`enviar.ts`), follow-ups (`followup.ts`), Business Discovery pra post de outra conta (`descoberta.ts`).
- `lib/agente/` — o agente do direct: turno (`turno.ts`), contexto, ferramentas, auditor determinístico, prompt padrão, grafo LangGraph.
- `lib/esteira/` — referências e análise (Gemini vê e ouve o vídeo), persona tirada dos reels do criador, carrossel (Claude via OpenRouter), render dos slides em PNG.
- `lib/roteiro/` — roteiros pra teleprompter. O servidor só transcreve e analisa a referência (`referencia.ts`, `processar.ts`); quem escreve é a estação (`editor/estacao/roteiros.mjs`, com o motor escolhido no painel). O escritor (`escritor.mjs`), a checagem anti-IA (`anti-ia.mjs`) e o padrão viral inicial (`padrao-inicial.mjs`) são JavaScript puro: o painel e a estação usam os mesmos arquivos. A voz vem do perfil + persona + reels do criador.
- `lib/postagem/publicar.ts` — postar o vídeo editado como Reel (container → processamento → publicar). O botão só cria o container; a página aberta e o relógio (a cada 15 s) conferem e publicam, com trava contra post duplo. A legenda é escrita pela estação.
- `lib/entregas/` + `app/(painel)/materiais` + `app/m/[slug]` — Materiais: o que o criador entrega no "comenta X", numa página pública `/m/<endereço>` com o perfil e as cores dele. Com "mandar na DM", a automação manda o link no lugar da sequência (`lib/instagram/receber.ts`) e o agente recebe o material no contexto.
- `lib/relogio.ts` + `lib/rotinas.ts` + `lib/trava.ts` — o que roda sozinho (modo cron na Vercel, modo servidor com `RELOGIO=ligado`).
- `editor/` — o editor de vídeo: `kit/` (a oficina HyperFrames e o manual `EDITOR.md` que o Claude lê) e `estacao/` (o que roda no PC, inclusive a escrita dos roteiros em `roteiros.mjs` + `texto.mjs`). `scripts/estacao-edicao.mjs` liga a estação. `estacao/escrita.mjs` é a parte que escreve (legenda do post e rascunho dos materiais), num laço à parte com o mesmo motor da edição.
- `supabase/migrations/` — o banco inteiro. Tudo no schema `criador`, RLS em todas as tabelas com `criador_privado.eh_da_equipe()`.

## Regras

- Configurações do criador ficam na tabela `configuracao` (`lib/config.ts`): perfil, persona, ofertas, instagram, facebook… Nunca hardcode nome, @ ou link.
- Segredos só em variável de ambiente (`.env.local` no PC, Environment Variables na Vercel). Nunca no código nem no git.
- Arquivo grande vai do navegador direto pro Storage com link assinado (a Vercel recusa corpo acima de ~4,5 MB).
- Server Action que usa a chave secreta ou gasta IA chama `exigirEquipe()` antes de tudo.
- Texto de interface em português do Brasil, curto e informal, falando com o criador ("você").
- Mudou o banco? Crie a próxima `supabase/migrations/NNN_….sql` (idempotente; nunca edite uma já publicada), registre ela em `MIGRACOES` (`lib/passos.ts`, com uma tabela que ela cria: o Início avisa quem ainda não rodou) e rode com `npm run migrar` ou no SQL Editor.
- Antes de dar por pronto: `npx tsc --noEmit`, `npm run lint` e `npm run build`.
