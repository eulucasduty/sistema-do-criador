# Sistema do Criador

O sistema de produção de conteúdo pra criador do Instagram, rodando nas **suas** contas:

- **Esteira de referências**: cole o link de um reel ou carrossel que bombou (ou suba o vídeo/os prints). A IA assiste, transcreve e explica por que funcionou.
- **Roteiro na sua voz**: a IA assiste os seus últimos reels, monta a sua persona e escreve a sua versão do formato, sem copiar frase de ninguém.
- **Cópia de carrossel**: a sua versão do carrossel da referência, com os slides prontos em PNG (no visual da referência ou da sua marca) e a legenda.
- **Editor de vídeo com IA** (o principal): você sobe o vídeo cru + prints e gravações de tela; volta editado, com cor, legenda palavra por palavra, motion, efeitos sonoros e o seu CTA. Roda no seu PC com o Claude Code, no seu plano do Claude: **sem custo de API**.
- **Automações do Instagram** (o "ManyChat" grátis): comentou a palavra → resposta pública + material na DM, com portão de seguidor, sequência de mensagens com botão, lembretes e follow-ups.
- **Agente de IA no direct** (opcional): conversa com quem respondeu a automação, tira dúvida e oferece o seu link.

Tudo fica no seu nome: o banco é seu, a hospedagem é sua, o app da Meta é seu. Ninguém mais tem acesso.

---

## Do que você precisa

| Conta | Pra quê | Custo |
| --- | --- | --- |
| [GitHub](https://github.com) | guardar a sua cópia do sistema | grátis |
| [Supabase](https://supabase.com) | banco de dados e arquivos | grátis |
| [Vercel](https://vercel.com) | deixar o sistema no ar | grátis (Hobby) |
| [OpenRouter](https://openrouter.ai) | a IA da Esteira, dos roteiros e do agente | pago por uso (US$ 5 duram bastante) |
| [Meta for Developers](https://developers.facebook.com) | o seu app pro Instagram | grátis |
| [Claude](https://claude.ai) Pro ou Max | o editor de vídeo (no seu PC) | a sua assinatura |

O Instagram precisa ser **conta profissional** (criador ou empresa).

---

## Instalação (uns 40 minutos, uma vez só)

### 1. Supabase (o banco)

1. Em [supabase.com](https://supabase.com), crie um projeto (região **South America (São Paulo)**). Guarde a senha do banco.
2. No projeto, abra **SQL Editor → New query**, cole o conteúdo inteiro de [`supabase/migrations/001_sistema.sql`](supabase/migrations/001_sistema.sql) e clique em **Run**. Tem que terminar com "Success".
3. Vá em **Project Settings → Data API → Exposed schemas**, adicione **`criador`** e salve.
4. Vá em **Project Settings → API Keys** e anote três coisas:
   - a **Project URL** (`https://xxxx.supabase.co`)
   - a **Publishable key** (`sb_publishable_...`)
   - a **Secret key** (`sb_secret_...`) → essa é segredo, não mostre pra ninguém

### 2. A sua cópia no GitHub

1. Entre no GitHub e clique em **Fork** no topo desta página → **Create fork**.
2. Pronto: `github.com/<seu-usuario>/sistema-do-criador` é a sua cópia. Quando sair versão nova, é só clicar em **Sync fork** lá e a Vercel atualiza sozinha.

### 3. Vercel (colocar no ar)

1. Em [vercel.com](https://vercel.com), entre com o GitHub → **Add New → Project** → escolha o seu `sistema-do-criador` → **Import**.
2. Abra **Environment Variables** e adicione:

   | Nome | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a Publishable key |
   | `SUPABASE_SECRET_KEY` | a Secret key |
   | `OPENROUTER_API_KEY` | a chave da OpenRouter (**Keys → Create Key**, começa com `sk-or-`) |
   | `CRON_SECRET` | uma senha qualquer que você inventa (só letras e números, 30+ caracteres) |
   | `IG_WEBHOOK_VERIFY_TOKEN` | outra senha qualquer que você inventa |

3. Clique em **Deploy** e espere uns 3 minutos. No fim, abra o endereço que a Vercel te deu (`https://sistema-do-criador-xxxx.vercel.app`).

### 4. A sua conta

No primeiro acesso, o sistema pede pra criar a conta: **faça isso logo depois do deploy**. Quem cria primeiro vira o dono; depois disso ninguém mais consegue criar.

Opcional, pra fechar de vez: no Supabase, **Authentication → Sign In / Providers → Allow new users to sign up** → desligado.

### 5. O passo a passo dentro do sistema

Daqui pra frente o **Início** do sistema te guia, com o status de cada coisa ao vivo:

1. Chave da IA (testar)
2. Seu perfil (nicho, público, jeito de falar, look do vídeo)
3. Instagram: o seu app na Meta (o passo mais longo, uns 20 min)
4. O relógio (um clique)
5. A estação de edição no seu PC → guia completo em [`editor/INSTALAR.md`](editor/INSTALAR.md)
6. A sua primeira automação

E os opcionais: Facebook (pra Esteira buscar reel só pelo link), sua persona e o agente de IA.

---

## Quanto custa pra rodar

- **Supabase, Vercel e Meta**: grátis no uso de um criador. (O plano Hobby da Vercel é pra uso pessoal; se o seu uso crescer, tem o Pro, ou dá pra rodar em servidor próprio com o `Dockerfile`.)
- **OpenRouter**: centavos por referência analisada e por roteiro; o agente do direct custa frações de centavo por resposta.
- **Editor de vídeo**: zero de API. Usa o Claude Code no seu plano do Claude (Pro ou Max), no seu PC.

## Problemas comuns

- **"Falta um passo no banco" / schema não exposto**: faltou o passo 1.3 (Exposed schemas → `criador`).
- **O webhook não verifica na Meta**: o token de verificação tem que ser idêntico à variável `IG_WEBHOOK_VERIFY_TOKEN`, e depois de mudar variável na Vercel é preciso fazer **Redeploy**.
- **Comentário de outra pessoa não chega**: o app da Meta ainda está em modo Desenvolvimento. Publique (modo Ao vivo).
- **O relógio não liga**: no Supabase, **Database → Extensions**, ligue `pg_cron` e `pg_net` e clique em ligar de novo.
- **Reel sem vídeo na Esteira**: conta pessoal e reel com música licenciada a Meta não libera. Suba o arquivo.

## Servidor próprio (opcional)

Prefere VPS? O `Dockerfile` está pronto. Use as mesmas variáveis, mais `APP_URL` (o endereço https) e `RELOGIO=ligado` (o relógio roda dentro do servidor e dispensa o pg_cron). Uma réplica só.

## Pra quem mexe no código

Next.js 16 (App Router), Supabase (schema `criador`, RLS em tudo), LangGraph + OpenRouter no agente, Gemini pra ver e ouvir vídeo, HyperFrames no editor. A pasta `editor/` é a oficina do editor de vídeo (roda no seu PC). O `CLAUDE.md` explica a estrutura pra você customizar com o Claude Code.

---

Criado por **Lucas Duty** ([@eulucasduty](https://instagram.com/eulucasduty)). Licença MIT: use, adapte e compartilhe.
