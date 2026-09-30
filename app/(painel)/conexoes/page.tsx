import Link from "next/link";
import { lerSituacao } from "@/lib/passos";
import { dataCurta, haQuanto } from "@/lib/formato";
import { conectarFacebookAcao, conectarInstagram, desligarRelogio, ligarRelogio, reinscreverInstagram, testarIA } from "./acoes";
import { Copiar } from "../copiar";

// Conexões: o estado de cada ligação do sistema e os formulários pra (re)conectar.
// O passo a passo com as explicações longas fica no Início.

export const dynamic = "force-dynamic";

function Ponto({ ok }: { ok: boolean | null }) {
  return <span className={`h-2 w-2 shrink-0 rounded-full ${ok === null ? "bg-apagado" : ok ? "bg-ok" : "bg-morno"}`} />;
}

function Linha({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      <Ponto ok={ok} /> <span>{children}</span>
    </p>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "erro"; children: React.ReactNode }) {
  return <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${tipo === "ok" ? "bg-ok/10 text-ok" : "bg-quente/10 text-quente"}`}>{children}</p>;
}

export default async function PaginaConexoes({ searchParams }: PageProps<"/conexoes">) {
  const q = await searchParams;
  const s = await lerSituacao();
  const ig = s.instagram;
  const fb = s.facebook;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="titulo">Conexões</h1>
        <p className="mt-1 text-sm text-suave">
          O que liga o sistema no Instagram, na IA e no seu PC. As explicações passo a passo estão no <Link href="/" className="text-marca underline">Início</Link>.
        </p>
      </div>

      {/* ── Instagram ── */}
      <section id="instagram" className="card scroll-mt-6 p-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Instagram</h2>
        {q.ig === "ok" && <Aviso tipo="ok">Instagram conectado e inscrito nos webhooks.</Aviso>}
        {(q.ig === "erro" || q.ig === "parcial") && <Aviso tipo="erro">{q.ig === "parcial" ? "Conectou, mas: " : "Não conectou: "}{String(q.msg ?? "")}</Aviso>}
        <div className="mt-4 space-y-3 text-sm">
          <Linha ok={Boolean(ig.token) && !ig.erro}>
            {ig.token
              ? `@${ig.username ?? "?"} · token renovado ${ig.renovado_em ? dataCurta(ig.renovado_em) : "—"}, vale até ${ig.expira_em ? dataCurta(ig.expira_em) : "—"} (renova sozinho)`
              : "Conta não conectada"}
          </Linha>
          {ig.erro && <p className="pl-4 text-quente">Atenção: {ig.erro}</p>}
          <form action={conectarInstagram} className="flex gap-2 pl-4">
            <input name="token" type="password" placeholder="token do Instagram (IGAA…)" className="campo font-mono" />
            <button className="btn btn-sm btn-2 shrink-0">{ig.token ? "Trocar" : "Conectar"}</button>
          </form>
          {ig.token && (
            <form action={reinscreverInstagram} className="pl-4">
              <button className="text-xs text-marca underline">Inscrever nos webhooks de novo</button>
            </form>
          )}
          <Linha ok={s.env.appSecret}>Chave secreta do app (META_APP_SECRET): {s.env.appSecret ? "configurada" : "falta"}</Linha>
          <Linha ok={s.env.verifyToken}>Token de verificação do webhook (IG_WEBHOOK_VERIFY_TOKEN): {s.env.verifyToken ? "configurado" : "falta"}</Linha>
          <Linha ok={Boolean(s.ultimoEventoIg)}>
            {s.ultimoEventoIg ? `Último evento da Meta: ${haQuanto(s.ultimoEventoIg.recebido_em)} (${s.ultimoEventoIg.tipo})` : "Nenhum evento da Meta chegou ainda"}
          </Linha>
          <dl className="space-y-1 pl-4 text-suave">
            <div className="flex flex-wrap items-center gap-2">
              URL de callback: <span className="font-mono text-texto">{s.url}/api/webhooks/instagram</span>
              <Copiar texto={`${s.url}/api/webhooks/instagram`} className="text-xs text-marca underline" />
            </div>
            <div>Campos: <span className="font-mono">comments, messages, messaging_postbacks, message_reactions</span></div>
            <div className="flex flex-wrap items-center gap-2">
              Privacidade e exclusão de dados: <span className="font-mono text-texto">{s.url}/privacidade</span>
              <Copiar texto={`${s.url}/privacidade`} className="text-xs text-marca underline" />
            </div>
          </dl>
        </div>
      </section>

      {/* ── Facebook (Esteira pelo link) ── */}
      <section id="facebook" className="card scroll-mt-6 p-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Facebook · Esteira pelo link (opcional)</h2>
        <p className="mt-1 text-sm text-suave">
          Com o login do Facebook ligado à sua página, a Esteira busca o vídeo (ou as imagens do carrossel) de posts de outras contas pela API
          oficial da Meta, só com o link. Conta pessoal e reel com música licenciada não vêm (a Meta esconde): nesses, suba o arquivo.
        </p>
        {q.fb === "ok" && <Aviso tipo="ok">Facebook conectado. As referências que estavam esperando vão ser buscadas agora.</Aviso>}
        {q.fb === "erro" && <Aviso tipo="erro">Não conectou: {String(q.msg ?? "")}</Aviso>}
        <div className="mt-4 space-y-3 text-sm">
          <Linha ok={fb.page_token ? !fb.erro : null}>{fb.page_token ? `Conectado pela página “${fb.page_nome}” (@${fb.ig_username})` : "Não conectado"}</Linha>
          {fb.page_token && (
            <p className="pl-4 text-suave">
              {fb.erro
                ? `Atenção: ${fb.erro}`
                : fb.expira_em
                  ? `O token vale até ${dataCurta(fb.expira_em)}: antes disso, gere de novo (o passo 6 estende pra não expirar).`
                  : `Token da página sem validade: não precisa renovar. Conectado ${fb.conectado_em ? dataCurta(fb.conectado_em) : ""}.`}
            </p>
          )}
          <details className="pl-4" open={!fb.page_token}>
            <summary className="cursor-pointer text-xs text-marca">Como gerar o token (uma vez só)</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-suave">
              <li>O seu Instagram precisa estar ligado a uma página do Facebook (Instagram → Configurações → Central de contas, ou pela página).</li>
              <li>
                Abra <span className="font-mono text-texto">developers.facebook.com/tools/explorer</span>, logado no Facebook que administra a página.
              </li>
              <li>Em “Meta App”, escolha o mesmo app que você criou pro Instagram. Em “User or Page”, deixe “User Token”.</li>
              <li>
                Em “Permissions”, adicione:{" "}
                <span className="font-mono text-texto">instagram_basic, pages_show_list, pages_read_engagement, business_management</span>.
              </li>
              <li>Clique “Generate Access Token” e, na janela, marque a página e o seu Instagram.</li>
              <li>
                Clique no “i” azul ao lado do token → “Open in Access Token Tool” → “Extend Access Token” e copie o token longo (assim o token da página
                não expira).
              </li>
              <li>Cole aqui embaixo e clique em Conectar.</li>
            </ol>
          </details>
          <form action={conectarFacebookAcao} className="flex gap-2 pl-4">
            <input name="token" type="password" placeholder="token do Facebook (EAA…)" className="campo font-mono" />
            <button className="btn btn-sm btn-2 shrink-0">{fb.page_token ? "Trocar" : "Conectar"}</button>
          </form>
        </div>
      </section>

      {/* ── Relógio ── */}
      <section id="relogio" className="card scroll-mt-6 p-4">
        <h2 className="font-display text-lg uppercase tracking-wide">Relógio</h2>
        <p className="mt-1 text-sm text-suave">O que roda sozinho: respostas do agente, lembretes das automações, renovação do token, análise pendente.</p>
        {q.relogio === "ok" && <Aviso tipo="ok">Relógio ligado.</Aviso>}
        {q.relogio === "desligado" && <Aviso tipo="ok">Relógio desligado.</Aviso>}
        {q.relogio === "erro" && <Aviso tipo="erro">{String(q.msg ?? "")}</Aviso>}
        <div className="mt-4 space-y-3 text-sm">
          <Linha ok={s.relogioBatendo}>
            {s.relogio.visto_em
              ? `Última batida ${haQuanto(s.relogio.visto_em)} (${s.relogio.modo === "servidor" ? "no servidor" : "pelo Supabase"})`
              : "Nunca bateu"}
          </Linha>
          <Linha ok={s.env.cron}>CRON_SECRET: {s.env.cron ? "configurada" : "falta"}</Linha>
          <Linha ok={s.relogioAgendado}>
            Agendamento no Supabase (pg_cron): {s.relogioAgendado === null ? "não deu pra conferir" : s.relogioAgendado ? "ligado" : "desligado"}
          </Linha>
          <div className="flex gap-2 pl-4">
            <form action={ligarRelogio}>
              <button className="btn btn-sm btn-2" disabled={!s.env.cron}>{s.relogioAgendado ? "Ligar de novo" : "Ligar"}</button>
            </form>
            {s.relogioAgendado && (
              <form action={desligarRelogio}>
                <button className="btn btn-sm btn-2">Desligar</button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── IA ── */}
      <section id="ia" className="card scroll-mt-6 p-4">
        <h2 className="font-display text-lg uppercase tracking-wide">IA (OpenRouter)</h2>
        {q.ia === "ok" && <Aviso tipo="ok">Chave ok: {String(q.msg ?? "")}.</Aviso>}
        {q.ia === "erro" && <Aviso tipo="erro">{String(q.msg ?? "")}</Aviso>}
        <div className="mt-4 space-y-3 text-sm">
          <Linha ok={s.env.openrouter}>OPENROUTER_API_KEY: {s.env.openrouter ? "configurada" : "falta"}</Linha>
          <p className="pl-4 text-suave">
            Ver e ouvir vídeo: <span className="font-mono">{process.env.AI_MODEL || "google/gemini-3.8-flash"}</span> · Escrever na sua voz:{" "}
            <span className="font-mono">{process.env.MODELO_CRIACAO || "anthropic/claude-sonnet-5"}</span> · o agente usa o modelo escolhido na tela dele.
          </p>
          {s.env.openrouter && (
            <form action={testarIA} className="pl-4">
              <button className="btn btn-sm btn-2">Testar a chave</button>
            </form>
          )}
        </div>
      </section>

      {/* ── Estação ── */}
      <section id="estacao" className="card scroll-mt-6 p-4 text-sm">
        <h2 className="font-display text-lg uppercase tracking-wide">Estação de edição</h2>
        <div className="mt-4 space-y-3">
          <Linha ok={s.estacaoLigada}>
            {s.estacaoLigada
              ? `Ligada em ${s.estacao.maquina ?? "seu PC"}${s.estacao.ocupada ? " · editando agora" : ""}`
              : s.estacao.visto_em
                ? `Desligada (vista ${haQuanto(s.estacao.visto_em)})`
                : "Nunca ligou"}
          </Linha>
          <p className="pl-4 text-suave">
            Liga no seu PC com <span className="font-mono">npm run estacao</span>. Como instalar: <Link href="/#estacao" className="text-marca underline">Início → passo 6</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
