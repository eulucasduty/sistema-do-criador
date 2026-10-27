import Link from "next/link";
import { Copiar } from "../copiar";

const passos = [
  { titulo: "Banco e hospedagem", cor: "text-marca", texto: "Crie um projeto Supabase exclusivo para o Creaty. Faça um fork do repositório e importe na sua hospedagem. Configure as três variáveis abaixo. No primeiro acesso, copie o SQL oferecido no login, execute no SQL Editor do Supabase e volte para criar a conta do dono.", codigo: "NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\nSUPABASE_SECRET_KEY=" },
  { titulo: "Seu perfil e sua IA", cor: "text-roxo", texto: "No Início, cole a chave da OpenRouter. Em Meu perfil, defina seu nome, @, nicho, público, tom e cores. Esse perfil orienta os roteiros e as artes. Em Referências, atualize a persona usando seus próprios reels. Em Roteiros → Padrão viral, acrescente regras e exemplos da sua fala.", href: "/perfil" },
  { titulo: "Conectar o Instagram", cor: "text-quente", texto: "Use uma conta profissional. Siga o passo a passo do Início para criar o app da Meta, conectar o token e configurar o webhook. O segredo do app fica em Conexões. Para monitorar perfis e importar referências de terceiros, conecte também o Facebook. Para publicar, o token precisa da permissão de publicação de conteúdo correspondente ao login escolhido.", href: "/conexoes" },
  { titulo: "Ligar o relógio", cor: "text-frio", texto: "Na Vercel, ative pg_cron e pg_net no Supabase e clique em Ligar relógio no Início. Na VPS, configure APP_URL com seu endereço HTTPS e RELOGIO=ligado, mantendo uma réplica. O relógio processa referências, monitoramento, automações e publicações agendadas. Confira o status no Início.", href: "/" },
  { titulo: "Preparar o computador", cor: "text-ok", texto: "Use Node.js 22 ou superior. Instale as dependências na pasta do projeto. O guia do editor explica FFmpeg, Whisper, o modelo de transcrição e a escolha da IA. Para os carrosséis, instale o Chromium do Playwright. As estações usam seu login de dono: não precisam de chave secreta no computador.", codigo: "npm ci\nnpx playwright install chromium\nnpm run estacao -- --preparar" },
  { titulo: "Abrir as estações", cor: "text-morno", texto: "Abra cada comando em um terminal separado, na pasta do projeto. Primeiro ligue a estação de edição e faça login; as outras reutilizam essa sessão. Escolha Claude ou ChatGPT no Editor e mantenha a CLI correspondente instalada e autenticada. Roteiros e materiais aguardam a estação de escrita; a API de roteiros só é usada pelo botão explícito. O motor OpenRouter do editor é configurado separadamente.", codigo: "npm run estacao\n\n# Em outro terminal:\nnpm run roteiro:estacao\n\n# Em outro terminal:\nnpm run carrossel:estacao" },
  { titulo: "Seu primeiro conteúdo", cor: "text-marca", texto: "Adicione uma referência ou crie um roteiro. Abra o teleprompter para ensaiar ou o gravador para fazer os takes. Na Esteira, escolha a edição, revise o vídeo e aprove o horário. Para carrosséis, envie todos os slides, confira a ordem e mande produzir. Revise os materiais do CTA antes de publicar. A agenda mostra o andamento das publicações.", href: "/esteira" },
];

export const metadata = { title: "Guia de instalação" };

export default function Guia() {
  return <div className="max-w-4xl space-y-6">
    <header className="card studio-hero p-6 sm:p-8">
      <p className="kicker">Comece por aqui</p>
      <h1 className="titulo mt-3">Seu Creaty, do seu jeito</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-suave">Da instalação ao primeiro post. Suas contas, seus arquivos e seu perfil de criador.</p>
    </header>
    <nav aria-label="Etapas da instalação" className="flex flex-wrap gap-2">{passos.map((p,i)=><a key={p.titulo} href={`#passo-${i+1}`} className="chip hover:text-marca">{i+1}. {p.titulo}</a>)}</nav>
    {passos.map((p,i)=><section key={p.titulo} id={`passo-${i+1}`} className="card scroll-mt-6 space-y-3 p-5 sm:p-6">
      <h2 className={`font-display text-xl ${p.cor}`}>{String(i+1).padStart(2,"0")} · {p.titulo}</h2>
      <p className="text-sm leading-relaxed text-suave">{p.texto}</p>
      {p.codigo && <div className="space-y-2"><pre className="overflow-x-auto rounded-xl bg-campo p-4 text-xs leading-6">{p.codigo}</pre><Copiar texto={p.codigo} rotulo="Copiar comandos" className="btn btn-sm btn-2" /></div>}
      {p.href && <Link href={p.href} className="text-sm font-bold text-marca underline">Abrir no Creaty →</Link>}
    </section>)}
    <section className="card space-y-3 p-6"><h2 className="rotulo">Atualizações e solução de problemas</h2><p className="text-sm text-suave">Instalação existente: aplique somente as migrações novas em ordem. A atualização de produção é a 002_producao.sql. Se você usou npm run migrar desde o início, continue usando esse comando. Faça backup antes de atualizar o banco.</p><p className="text-sm text-suave">Fila parada: confira a estação correspondente e o relógio. Link sem vídeo: envie o arquivo; o download de algumas redes exige yt-dlp numa VPS. Falha na publicação: confira o erro na agenda e as permissões da Meta. Mudou variáveis na hospedagem: gere um novo deploy.</p><p className="text-sm text-suave">O README do projeto contém a instalação local, Docker, variáveis e comandos de verificação. Custos e disponibilidade dependem dos provedores e dos seus planos.</p></section>
  </div>;
}
