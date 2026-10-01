# Creator System

O sistema de produção de conteúdo pra criador do Instagram, rodando nas **suas** contas:

- **Esteira de referências**: cole o link de um reel ou carrossel que bombou (ou suba o vídeo/os prints). A IA assiste, transcreve e explica por que funcionou.
- **Roteiro na sua voz**: a IA assiste os seus últimos reels, monta a sua persona e escreve a sua versão do formato, sem copiar frase de ninguém.
- **Cópia de carrossel**: a sua versão do carrossel da referência, com os slides prontos em PNG (no visual da referência ou da sua marca) e a legenda.
- **Editor de vídeo com IA** (o principal): você sobe o vídeo cru + prints e gravações de tela, escolhe um dos **32 estilos de edição** (do clássico com legenda acendendo aos virais de legenda gigante, tela dividida, 3D, documentário, texto atrás de você, telejornal) e ele volta editado, com cor, legenda, motion, efeitos sonoros e o seu CTA. Roda no seu computador com a IA que você já assina (Claude ou ChatGPT) ou pela OpenRouter.
- **Automações do Instagram** (o "ManyChat" grátis): comentou a palavra → resposta pública + material na DM, com portão de seguidor, sequência de mensagens com botão, lembretes e follow-ups.
- **Agente de IA no direct** (opcional): conversa com quem respondeu a automação, tira dúvida e oferece o seu link.

Tudo fica no seu nome: o banco é seu, a hospedagem é sua, o app da Meta é seu. Ninguém mais tem acesso.

---

## Do que você precisa (tudo grátis pra criar)

| Conta | Pra quê |
| --- | --- |
| [Supabase](https://supabase.com) | onde ficam os seus dados |
| [GitHub](https://github.com) | a sua cópia do sistema |
| [Vercel](https://vercel.com) | deixar o sistema no ar |
| [OpenRouter](https://openrouter.ai) | a IA que assiste e escreve (você paga só o que usar; US$ 5 duram bastante) |
| [Meta for Developers](https://developers.facebook.com) | o seu app pro Instagram |

E pro editor de vídeo: um computador (Windows ou Mac) e uma assinatura do **Claude** (Pro/Max) **ou** do **ChatGPT** (Plus/Pro). Não tem nenhuma das duas? Dá pra usar a OpenRouter, pagando por vídeo.

O Instagram precisa ser **conta profissional** (criador ou empresa).

---

## Instalação (uns 20 minutos)

### 1. Supabase

1. Entre em [supabase.com](https://supabase.com) → **New project**. Nome: `sistema`. Crie uma senha qualquer (guarde). Região: **South America (São Paulo)**. Clique em **Create**.
2. Espere uns 2 minutos o projeto ficar pronto.
3. Vá em **Project Settings → API Keys** e deixe essa aba aberta: você vai copiar 3 coisas daqui no passo 3.
   - **Project URL** (fica em Project Settings → Data API; começa com `https://` e termina com `.supabase.co`)
   - **Publishable key** (`sb_publishable_...`)
   - **Secret key** (`sb_secret_...`, clique em Reveal) → é segredo, não mostre pra ninguém

### 2. GitHub

1. Crie a conta em [github.com](https://github.com) (se não tiver).
2. Nesta página, clique em **Fork** (no topo, à direita) → **Create fork**. Pronto: essa é a sua cópia.

### 3. Vercel

1. Entre em [vercel.com](https://vercel.com) com o GitHub.
2. **Add New → Project** → ache o `sistema-do-criador` → **Import**.
3. Abra **Environment Variables** e adicione as 3 (nome à esquerda, valor à direita):

   | Nome | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a Publishable key |
   | `SUPABASE_SECRET_KEY` | a Secret key |

4. Clique em **Deploy** e espere uns 3 minutos. No fim, clique na imagem do site pra abrir o seu sistema (`https://sistema-do-criador-xxxx.vercel.app`). Guarde esse endereço.

### 4. Abrir o sistema

1. Na primeira vez, o sistema pede pra criar as tabelas: clique em **Copiar o SQL**, abra o link do SQL Editor que ele mostra, cole e clique em **Run**. Volte e recarregue.
2. Crie a sua conta: nome, e-mail, senha e a **Secret key** do Supabase (a mesma da Vercel). A chave prova que o sistema é seu: quem só achar o seu endereço não consegue virar dono.

### 5. O resto é dentro do sistema

O **Início** te guia, com o status de cada passo ao vivo:

1. Chave da IA (colar a chave da OpenRouter)
2. Seu perfil
3. Instagram: o seu app na Meta (o passo mais longo, uns 20 min)
4. O relógio (um clique)
5. A estação de edição no seu computador (um comando)
6. A sua primeira automação

---

## Quanto custa pra rodar

- **Supabase, Vercel, GitHub e Meta**: grátis no uso de um criador. (O plano grátis da Vercel é pra uso pessoal; se o seu uso crescer, tem o Pro, ou dá pra rodar em servidor próprio com o `Dockerfile`.)
- **OpenRouter**: centavos por referência analisada e por roteiro; o agente do direct custa frações de centavo por resposta.
- **Editor de vídeo**: zero de API se você usa a sua assinatura do Claude ou do ChatGPT. Pela OpenRouter, paga por vídeo.

## Atualizar

Quando sair versão nova: abra a sua cópia no GitHub e clique em **Sync fork → Update branch**. A Vercel atualiza sozinha. A estação do computador se atualiza rodando o instalador de novo.

## Problemas comuns

- **"Falta um passo da instalação"**: a tela diz qual variável falta. Depois de mudar variável na Vercel, vá em **Deployments → ⋯ → Redeploy**.
- **O webhook não verifica na Meta**: copie de novo o token de verificação que o Início mostra (passo 4) e confira a URL de callback.
- **Comentário de outra pessoa não chega**: o app da Meta ainda está em modo Desenvolvimento. Publique (modo Ao vivo).
- **O relógio não liga**: no Supabase, **Database → Extensions**, ligue `pg_cron` e `pg_net` e clique em ligar de novo.
- **Reel sem vídeo na Esteira**: conta pessoal e reel com música licenciada a Meta não libera. Suba o arquivo.

## Servidor próprio (opcional)

Prefere VPS? O `Dockerfile` está pronto. Use as mesmas 3 variáveis, mais `APP_URL` (o endereço https) e `RELOGIO=ligado` (o relógio roda dentro do servidor e dispensa o pg_cron). Uma réplica só.

## Ver o painel sem instalar nada

No seu computador, com o Node instalado: `npm install` e depois `npm run demo`. Abre em http://localhost:3100 com dados de exemplo (nada é salvo).

## Pra quem mexe no código

Next.js 16 (App Router), Supabase (RLS em tudo), LangGraph + OpenRouter no agente, Gemini pra ver e ouvir vídeo, HyperFrames no editor. A pasta `editor/` é a oficina do editor de vídeo (roda no seu computador). O `CLAUDE.md` explica a estrutura pra você customizar com o Claude Code ou o Codex.

---

Criado por **Lucas Duty** ([@eulucasduty](https://instagram.com/eulucasduty)). Licença MIT: use, adapte e compartilhe.
