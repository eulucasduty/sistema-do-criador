# Creator System

O sistema de produção de conteúdo pra criador do Instagram, rodando nas **suas** contas:

- **Esteira de referências**: cole o link de um reel ou carrossel que bombou (ou suba o vídeo/os prints). A IA assiste, transcreve e explica por que funcionou.
- **Roteiros pra teleprompter**: sobre um tema ou a partir de um vídeo que viralizou (o arquivo, o link do Instagram ou um reel da Esteira). Na sua voz (a IA assiste os seus últimos reels e monta a sua persona), no padrão dos vídeos que viralizam, sem copiar frase de ninguém e com uma checagem anti-IA que reescreve o que soa como robô. Sai em gancho, corpo e CTA, uma ideia por linha, com um teleprompter que roda na tela do celular. Quem escreve é a estação no seu computador, com a mesma IA do editor.
- **Cópia de carrossel**: o carrossel da referência (de qualquer idioma) em português, slide por slide, com as cores, as fotos e a composição do original, a headline da capa que você quiser e a sua foto + o seu @ em todos. Sai em PNG 1080×1350 (slide em vídeo sai em MP4), com a legenda. Quem faz é a estação no seu computador, com a mesma IA do editor.
- **Editor de vídeo com IA** (o principal): você sobe o vídeo cru + prints e gravações de tela, escolhe um dos **36 estilos de edição** (do clássico com legenda acendendo e as quatro variações dele, aos virais de legenda gigante, tela dividida, 3D, documentário, texto atrás de você, telejornal) e ele volta editado, com legenda, **motion animado de verdade** (vídeos curtos com personagens, câmera e impacto, feitos em Remotion), cards que se mexem a cena inteira, efeitos sonoros e o seu CTA. Roda no seu computador com a IA que você já assina (Claude ou ChatGPT) ou pela OpenRouter.
- **Postar com 1 clique**: quando o vídeo fica pronto, a estação escreve a legenda na sua voz (com o "comenta X" do CTA). Você muda o que quiser e um botão posta como Reel na sua conta, pela API oficial. Ele ainda avisa se alguma automação responde a palavra do CTA.
- **Materiais**: o que você entrega no "comenta X" vira uma página no celular (passo a passo, prompts com botão de copiar, links, templates), em `/m/<palavra>`, com o seu @, a sua foto e as cores da sua marca. A estação monta o rascunho a partir do que você falou no vídeo; você revisa e publica, e quem comenta recebe o link na DM.
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

E pro editor de vídeo e os roteiros: um computador (Windows ou Mac) e uma assinatura do **Claude** (Pro/Max) **ou** do **ChatGPT** (Plus/Pro). Não tem nenhuma das duas? Dá pra usar a OpenRouter, pagando por vídeo.

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
5. A estação no seu computador (um comando): edita os vídeos, escreve os roteiros e faz as cópias de carrossel
6. A sua primeira automação

---

## Quanto custa pra rodar

- **Supabase, Vercel, GitHub e Meta**: grátis no uso de um criador. (O plano grátis da Vercel é pra uso pessoal; se o seu uso crescer, tem o Pro, ou dá pra rodar em servidor próprio com o `Dockerfile`.)
- **OpenRouter**: centavos por referência analisada e por roteiro; o agente do direct custa frações de centavo por resposta.
- **Editor de vídeo e roteiros**: zero de API se você usa a sua assinatura do Claude ou do ChatGPT. Pela OpenRouter, paga por vídeo (e uns centavos por roteiro).

## Atualizar

Quando sair versão nova: abra a sua cópia no GitHub e clique em **Sync fork → Update branch**. A Vercel atualiza sozinha. A estação do computador se atualiza rodando o instalador de novo.

Se a versão nova trouxer tabela nova no banco (um arquivo novo em `supabase/migrations`, como `004_carrossel.sql`), o **Início** avisa e mostra o SQL pra copiar: cole no **SQL Editor** do Supabase e clique em **Run** (1 minuto; pode rodar de novo sem medo, não estraga nada). Quem roda o sistema pelo terminal pode usar `npm run migrar`.

## Problemas comuns

- **"Falta um passo da instalação"**: a tela diz qual variável falta. Depois de mudar variável na Vercel, vá em **Deployments → ⋯ → Redeploy**.
- **O webhook não verifica na Meta**: copie de novo o token de verificação que o Início mostra (passo 4) e confira a URL de callback.
- **Comentário de outra pessoa não chega**: o app da Meta ainda está em modo Desenvolvimento. Publique (modo Ao vivo).
- **O relógio não liga**: no Supabase, **Database → Extensions**, ligue `pg_cron` e `pg_net` e clique em ligar de novo.
- **"O token do Instagram não tem a permissão de publicar"** (no Postar no Instagram): no app da Meta, **Casos de uso → Instagram → Personalizar → Permissões e recursos**, adicione `instagram_business_content_publish`, gere o token de novo e troque em **Conexões → Instagram**.
- **A legenda ou o material não sai da fila**: quem escreve é a estação no seu computador. Abra o atalho **Estação de edição**.
- **Reel sem vídeo na Esteira**: conta pessoal e reel com música licenciada a Meta não libera. Suba o arquivo.
- **Cópia de carrossel parada em "esperando a estação"**: a estação do seu computador está desligada. Abra o atalho **Estação de edição**; o pedido sai sozinho.

## Servidor próprio (opcional)

Prefere VPS? O `Dockerfile` está pronto. Use as mesmas 3 variáveis, mais `APP_URL` (o endereço https) e `RELOGIO=ligado` (o relógio roda dentro do servidor e dispensa o pg_cron). Uma réplica só.

## Ver o painel sem instalar nada

No seu computador, com o Node instalado: `npm install` e depois `npm run demo`. Abre em http://localhost:3100 com dados de exemplo (nada é salvo).

## Pra quem mexe no código

Next.js 16 (App Router), Supabase (RLS em tudo), LangGraph + OpenRouter no agente, Gemini pra ver e ouvir vídeo, HyperFrames no editor. A pasta `editor/` é a oficina do editor de vídeo (roda no seu computador). O `CLAUDE.md` explica a estrutura pra você customizar com o Claude Code ou o Codex.

---

Criado por **Lucas Duty** ([@eulucasduty](https://instagram.com/eulucasduty)). Licença MIT: use, adapte e compartilhe.
