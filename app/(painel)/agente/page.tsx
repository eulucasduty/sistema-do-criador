import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dataCurta, haQuanto, horasAtras, nomeDoContato } from "@/lib/formato";
import { PROMPT_PADRAO } from "@/lib/agente/prompt";
import { iaConfigurada } from "@/lib/ia/openrouter";
import { instagramConfigurado } from "@/lib/instagram/api";
import type { FollowupAgente, Oferta } from "@/lib/config";
import {
  alternarAgente,
  apagarConhecimento,
  pausarGeral,
  restaurarVersao,
  salvarConfigAgente,
  salvarConhecimento,
  salvarPerfisTeste,
  salvarToques,
  type MensagemSimulada,
} from "./acoes";
import { EditorSimulador } from "./editor-simulador";
import { EditorOfertas } from "./ofertas";
import { FormAcao } from "./form-acao";

export const dynamic = "force-dynamic";

const MODELOS = [
  "openai/gpt-6-luna",
  "google/gemini-3.8-flash",
  "google/gemini-3.7-flash",
  "anthropic/claude-sonnet-5",
  "openai/gpt-5.6-luna",
  "x-ai/grok-4.3",
];

const RESULTADO: Record<string, { rotulo: string; cor: string }> = {
  respondeu: { rotulo: "respondeu", cor: "text-ok" },
  escalou: { rotulo: "passou pra você", cor: "text-morno" },
  encerrou: { rotulo: "encerrou", cor: "text-suave" },
  bloqueado: { rotulo: "barrado", cor: "text-quente" },
  pulou: { rotulo: "pulou", cor: "text-apagado" },
  erro: { rotulo: "erro", cor: "text-quente" },
};

const FOLLOWUP_PADRAO: FollowupAgente = { horas: 23, antes_da_oferta: "{nome}?", depois_da_oferta: "conseguiu abrir o link?" };

type Automacao = {
  id: string;
  nome: string;
  modo: string;
  ativa: boolean;
  dm_abertura: string;
  botao_abertura: string | null;
  entrega_mensagens: Array<{ texto?: string; botao_titulo?: string; botao_url?: string }> | null;
  dm_entrega: string | null;
  link_entrega: string | null;
};

function pausaDe(ate: string | null): string | null {
  if (!ate) return null;
  if (ate === "infinity") return "até você retomar";
  return new Date(ate) > new Date() ? `até ${dataCurta(ate)}` : null;
}

/** O que a automação manda antes do agente entrar, pro simulador começar do ponto certo. */
function sequenciaDa(a: Automacao): MensagemSimulada[] {
  const trocar = (t: string) => t.replaceAll("{nome}", "fulana").replaceAll("{link}", a.link_entrega ?? "").trim();
  const botao = a.modo === "botao" ? a.botao_abertura || "quero" : null;
  const entrega = (a.entrega_mensagens ?? []).filter((m) => (m.texto ?? "").trim() || m.botao_url);
  const mensagens = entrega.length ? entrega : [{ texto: a.dm_entrega || "tá aqui 👇 {link}" }];
  return [
    { autor: "agente", texto: trocar(a.dm_abertura) + (botao ? `\n[botão: ${botao}]` : ""), automacao: true },
    { autor: "contato", texto: botao ?? "quero!", automacao: true },
    ...mensagens.map((m) => ({
      autor: "agente" as const,
      texto: [trocar(m.texto ?? ""), m.botao_titulo ? `[botão: ${m.botao_titulo}]` : ""].filter(Boolean).join("\n"),
      automacao: true,
    })),
  ];
}

export default async function PaginaAgente() {
  const supabase = await createClient();
  const { data: agente } = await supabase.from("agente").select("*").order("criado_em").limit(1).maybeSingle();

  if (!agente) {
    return (
      <div className="max-w-2xl">
        <h1 className="titulo">Agente de IA</h1>
        <p className="card mt-4 p-4 text-sm text-suave">
          O agente não está no banco. Rode a migração do sistema (o passo a passo está em <Link href="/conexoes" className="text-marca underline">Conexões</Link>).
        </p>
      </div>
    );
  }

  const [
    { data: versoes },
    { data: conhecimento },
    { data: turnos },
    { data: turnos24h },
    { data: contatos },
    { data: automacoes },
    { data: configs },
    instagramOk,
  ] = await Promise.all([
    supabase.from("agente_versao").select("id, nota, criado_em, prompt").eq("agente_id", agente.id).order("criado_em", { ascending: false }).limit(15),
    supabase.from("conhecimento").select("id, titulo, conteudo, ativo").order("criado_em"),
    supabase
      .from("agente_turno")
      .select("id, criado_em, resultado, motivo, entrada, resposta, custo_usd, simulacao, auditoria, contato:contato_id (id, nome, instagram_usuario)")
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase.from("agente_turno").select("resultado, custo_usd").eq("simulacao", false).gte("criado_em", horasAtras(24)),
    supabase
      .from("contato")
      .select("id, nome, instagram_usuario")
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
      .limit(25),
    supabase
      .from("ig_automacao")
      .select("id, nome, modo, ativa, dm_abertura, botao_abertura, entrega_mensagens, dm_entrega, link_entrega")
      .order("criado_em", { ascending: false }),
    supabase.from("configuracao").select("chave, valor").in("chave", ["ofertas", "perfis_teste", "followup_agente", "pausa_por_eco_horas"]),
    instagramConfigurado().catch(() => false),
  ]);

  const config = new Map((configs ?? []).map((c) => [c.chave as string, c.valor as unknown]));
  const ofertas = (config.get("ofertas") as Oferta[] | undefined) ?? [];
  const perfisTeste = (config.get("perfis_teste") as string[] | undefined) ?? [];
  const followup = { ...FOLLOWUP_PADRAO, ...((config.get("followup_agente") as Partial<FollowupAgente> | undefined) ?? {}) };
  const pausaEco = Number(config.get("pausa_por_eco_horas") ?? 48) || 48;

  const autos = (automacoes ?? []) as Automacao[];
  const noModoAgente = autos.filter((a) => a.modo === "agente" && a.ativa);
  const pausa = pausaDe(agente.pausado_ate);
  const iaOk = iaConfigurada();
  const reais = turnos24h ?? [];
  const conta = (r: string) => reais.filter((t) => t.resultado === r).length;
  const custo24h = reais.reduce((s, t) => s + Number(t.custo_usd ?? 0), 0);

  return (
    <div className="max-w-6xl space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="titulo">Agente de IA</h1>
          <p className="mt-2 text-sm">
            {agente.ativo ? (
              pausa ? (
                <span className="text-morno">Ligado, mas em pausa geral {pausa}.</span>
              ) : (
                <span className="text-ok">
                  Ligado: conversa com quem veio de {noModoAgente.length === 1 ? "1 automação" : `${noModoAgente.length} automações`} no modo agente.
                </span>
              )
            ) : (
              <span className="text-suave">
                Desligado.{" "}
                {perfisTeste.length ? `Só responde os perfis de teste (${perfisTeste.length}).` : "Não responde ninguém."}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-apagado">
            Últimas 24 h: {conta("respondeu")} respostas · {conta("escalou")} passadas pra você · {conta("encerrou")} encerradas
            {conta("erro") + conta("bloqueado") > 0 && <span className="text-quente"> · {conta("erro") + conta("bloqueado")} com problema</span>} · US${" "}
            {custo24h.toFixed(3)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agente.ativo && (
            <form action={pausarGeral} className="flex gap-2">
              <select name="opcao" defaultValue={pausa ? "retomar" : "1h"} className="campo w-auto">
                <option value="1h">Pausa geral 1 h</option>
                <option value="3h">Pausa geral 3 h</option>
                <option value="amanha">Pausa até amanhã 9h</option>
                <option value="sempre">Pausa até eu retomar</option>
                <option value="retomar">Retomar agora</option>
              </select>
              <button className="btn btn-sm btn-2">Aplicar</button>
            </form>
          )}
          <form action={alternarAgente}>
            <input type="hidden" name="ativo" value={agente.ativo ? "nao" : "sim"} />
            <button className={`btn btn-sm ${agente.ativo ? "btn-perigo" : ""}`}>{agente.ativo ? "Desligar" : "Ligar o agente"}</button>
          </form>
        </div>
      </header>

      {!iaOk && (
        <p className="rounded-lg border border-morno/40 bg-morno/10 px-3 py-2 text-sm text-morno">
          Falta a chave da OpenRouter: sem ela o agente não responde (nem no simulador). Veja em{" "}
          <Link href="/conexoes" className="underline">Conexões</Link>.
        </p>
      )}
      {!instagramOk && (
        <p className="rounded-lg border border-morno/40 bg-morno/10 px-3 py-2 text-sm text-morno">
          O Instagram ainda não está conectado. Dá pra testar no simulador, mas ele só responde de verdade depois de{" "}
          <Link href="/conexoes" className="underline">conectar</Link>.
        </p>
      )}
      {agente.ativo && !noModoAgente.length && (
        <p className="rounded-lg border border-morno/40 bg-morno/10 px-3 py-2 text-sm text-morno">
          Ele está ligado, mas nenhuma automação ligada está no modo agente. Em{" "}
          <Link href="/instagram" className="underline">Automações</Link>, escolha “Depois da entrega: o agente continua”.
        </p>
      )}

      <section className="card p-4 text-sm">
        <h2 className="font-display text-base uppercase tracking-wide">Como funciona</h2>
        <ul className="mt-2 space-y-1.5 text-suave">
          <li>
            <b className="text-texto">É opcional.</b> As automações funcionam sem ele: comentou → DM → entrega do material. O agente é pra quem quer
            continuar a conversa depois.
          </li>
          <li>
            <b className="text-texto">Com quem ele fala:</b> só com quem veio de uma automação no modo agente, e só depois da entrega. DM de quem não
            veio de automação fica pra você responder.
          </li>
          <li>
            <b className="text-texto">Quando passa pra você:</b> alguém quer comprar, pede pra falar com você, reclama ou pergunta se é robô. Aparece em{" "}
            <Link href="/contatos" className="text-marca underline">Leads → Precisa de você</Link> e ele sai daquela conversa.
          </li>
          <li>
            <b className="text-texto">Você respondeu pelo app do Instagram?</b> Ele sai daquela conversa por {pausaEco} h sozinho.
          </li>
          <li>
            <b className="text-texto">Custo:</b> cada resposta gasta na OpenRouter (o valor aparece embaixo, em Últimas respostas). Teste no simulador
            antes de ligar.
          </li>
        </ul>
      </section>

      <nav className="flex flex-wrap gap-2 text-xs">
        {[
          ["#prompt", "Prompt e simulador"],
          ["#config", "Como ele trabalha"],
          ["#ofertas", "Ofertas"],
          ["#base", "Base de conhecimento"],
          ["#teste", "Teste e toques"],
          ["#respostas", "Últimas respostas"],
        ].map(([href, rotulo]) => (
          <a key={href} href={href} className="rounded-full border border-borda px-3 py-1 text-suave hover:text-texto">
            {rotulo}
          </a>
        ))}
      </nav>

      <section id="prompt" className="scroll-mt-6">
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Prompt e simulador</h2>
        <EditorSimulador
          promptSalvo={agente.prompt ?? ""}
          promptPadrao={PROMPT_PADRAO}
          contatos={(contatos ?? []).map((c) => ({ id: c.id, nome: nomeDoContato(c) }))}
          automacoes={autos.map((a) => ({ id: a.id, nome: a.nome, modo: a.modo, sequencia: sequenciaDa(a) }))}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section id="config" className="card scroll-mt-6 p-4">
          <h2 className="font-display text-base uppercase tracking-wide">Como ele trabalha</h2>
          <FormAcao acao={salvarConfigAgente} className="mt-3 space-y-3 text-sm">
            <label className="block">
              <span className="text-xs text-apagado">Modelo (qualquer um da OpenRouter)</span>
              <input name="modelo" list="modelos" required defaultValue={agente.modelo} className="campo mt-1" />
              <datalist id="modelos">
                {MODELOS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-apagado">Temperatura (0 a 2)</span>
                <input name="temperatura" type="number" step="0.05" min="0" max="2" defaultValue={Number(agente.temperatura)} className="campo mt-1" />
              </label>
              <label className="block">
                <span className="text-xs text-apagado">Respostas por conversa</span>
                <input name="limite_mensagens" type="number" min="1" max="50" defaultValue={agente.limite_mensagens} className="campo mt-1" />
              </label>
            </div>
            <p className="-mt-1 text-[11px] text-apagado">Temperatura mais alta = mais solto e variado. Chegou no limite de respostas, passa pra você.</p>
            <label className="block">
              <span className="text-xs text-apagado">Espera antes de responder (segundos)</span>
              <input name="espera_segundos" type="number" min="0" max="900" defaultValue={agente.espera_segundos} className="campo mt-1" />
              <span className="mt-1 block text-[11px] text-apagado">Junta as mensagens picadas da pessoa numa resposta só e parece gente.</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-apagado">Responde das</span>
                <input name="horario_inicio" type="time" defaultValue={String(agente.horario_inicio).slice(0, 5)} className="campo mt-1" />
              </label>
              <label className="block">
                <span className="text-xs text-apagado">até (horário de Brasília)</span>
                <input name="horario_fim" type="time" defaultValue={String(agente.horario_fim).slice(0, 5)} className="campo mt-1" />
              </label>
            </div>
            <p className="-mt-1 text-[11px] text-apagado">Fora do horário ele responde quando abrir. Início igual ao fim = 24 h.</p>
          </FormAcao>
        </section>

        <section id="ofertas" className="card scroll-mt-6 p-4 lg:col-span-2">
          <h2 className="font-display text-base uppercase tracking-wide">Ofertas</h2>
          <p className="mt-1 text-xs text-suave">
            Os links que ele pode oferecer no fim da conversa (produto, mentoria, grupo, agenda…), até 5. Ele só oferece quando combina com o que a
            pessoa contou. O link vai com o código da pessoa, então você vê quem clicou em Leads. Sem oferta, ele só ajuda.
          </p>
          <div className="mt-3">
            <EditorOfertas iniciais={ofertas} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section id="base" className="card scroll-mt-6 p-4 lg:col-span-2">
          <h2 className="font-display text-base uppercase tracking-wide">Base de conhecimento</h2>
          <p className="mt-1 text-xs text-suave">
            Os fatos que ele pode usar: preço, o que tem em cada produto, perguntas frequentes. Fora daqui ele não inventa. Desmarque “ativo” pra tirar
            sem apagar.
          </p>
          <ul className="mt-3 space-y-2">
            {(conhecimento ?? []).map((k) => (
              <li key={k.id}>
                <details className="rounded-lg border border-borda bg-superficie-2">
                  <summary className="cursor-pointer px-3 py-2 text-sm">
                    <span className={k.ativo ? "" : "text-apagado line-through"}>{k.titulo}</span>
                    <span className="ml-2 text-xs text-apagado">{k.conteudo.slice(0, 70)}{k.conteudo.length > 70 ? "…" : ""}</span>
                  </summary>
                  <div className="border-t border-borda p-3">
                    <FormAcao
                      acao={salvarConhecimento}
                      className="space-y-2"
                      extra={
                        <label className="flex items-center gap-2 text-xs text-suave">
                          <input type="checkbox" name="ativo" defaultChecked={k.ativo} /> ativo
                        </label>
                      }
                    >
                      <input type="hidden" name="id" value={k.id} />
                      <input name="titulo" required maxLength={120} defaultValue={k.titulo} className="campo" />
                      <textarea name="conteudo" required defaultValue={k.conteudo} rows={4} className="campo" />
                    </FormAcao>
                    <form action={apagarConhecimento} className="mt-2 text-right">
                      <input type="hidden" name="id" value={k.id} />
                      <button className="rounded-md px-2 py-1 text-xs text-quente hover:bg-quente/10">Apagar</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {!conhecimento?.length && <p className="mt-3 text-sm text-apagado">Nada ainda. Comece pelo que mais te perguntam no direct.</p>}
          <details className="mt-3 rounded-lg border border-dashed border-borda" open={!conhecimento?.length}>
            <summary className="cursor-pointer px-3 py-2 text-sm text-marca">+ Novo fato</summary>
            <FormAcao acao={salvarConhecimento} botao="Adicionar" limpar className="space-y-2 p-3">
              <input name="titulo" required maxLength={120} placeholder="Título (ex.: Quanto custa a mentoria)" className="campo" />
              <textarea name="conteudo" required rows={3} placeholder="O que ele pode dizer sobre isso" className="campo" />
              <input type="hidden" name="ativo" value="on" />
            </FormAcao>
          </details>
        </section>

        <section id="teste" className="card scroll-mt-6 space-y-6 p-4">
          <div>
            <h2 className="font-display text-base uppercase tracking-wide">Perfis de teste</h2>
            <p className="mt-1 text-xs text-suave">
              Com o agente desligado, ele responde só estes @, a qualquer hora. É o jeito de testar no direct de verdade antes de ligar pra todo mundo:
              comente num post com automação no modo agente usando um destes perfis.
            </p>
            <FormAcao acao={salvarPerfisTeste} className="mt-2 space-y-2">
              <textarea
                name="perfis"
                rows={3}
                defaultValue={perfisTeste.map((p) => `@${p}`).join("\n")}
                placeholder="@seu_perfil_teste (um por linha)"
                className="campo font-mono"
              />
            </FormAcao>
          </div>

          <div>
            <h2 className="font-display text-base uppercase tracking-wide">Toques e pausa</h2>
            <p className="mt-1 text-xs text-suave">
              Quem sumiu no meio da conversa com o agente recebe um toque (uma vez), dentro da janela de 24 h do Instagram. {"{nome}"} vira o nome da
              pessoa. Vazio = sem toque.
            </p>
            <FormAcao acao={salvarToques} className="mt-2 space-y-2 text-sm">
              <label className="block">
                <span className="text-xs text-apagado">Horas depois da última mensagem dela (até 23,5)</span>
                <input name="horas" type="number" min="1" max="23.5" step="0.5" defaultValue={followup.horas} className="campo mt-1" />
              </label>
              <label className="block">
                <span className="text-xs text-apagado">Toque antes da oferta</span>
                <input name="antes_da_oferta" maxLength={300} defaultValue={followup.antes_da_oferta} placeholder="{nome}?" className="campo mt-1" />
              </label>
              <label className="block">
                <span className="text-xs text-apagado">Toque depois da oferta (se ela não clicou)</span>
                <input name="depois_da_oferta" maxLength={300} defaultValue={followup.depois_da_oferta} placeholder="conseguiu abrir o link?" className="campo mt-1" />
              </label>
              <label className="block">
                <span className="text-xs text-apagado">Você respondeu pelo app: ele sai da conversa por (horas)</span>
                <input name="pausa_por_eco_horas" type="number" min="1" max="720" defaultValue={pausaEco} className="campo mt-1" />
              </label>
            </FormAcao>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section id="respostas" className="scroll-mt-6 lg:col-span-2">
          <h2 className="mb-3 rotulo">Últimas respostas</h2>
          {!turnos?.length ? (
            <p className="card p-4 text-sm text-suave">Nenhuma resposta ainda. As do simulador também aparecem aqui.</p>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {turnos.map((t) => {
                const contato = (Array.isArray(t.contato) ? t.contato[0] : t.contato) as { id: string; nome: string | null; instagram_usuario: string | null } | null;
                const avisos = ((t.auditoria as { avisos?: string[] } | null)?.avisos ?? []).join(", ");
                const r = RESULTADO[t.resultado] ?? { rotulo: t.resultado, cor: "" };
                return (
                  <li key={t.id} className="p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={`font-medium ${r.cor}`}>{r.rotulo}</span>
                      {t.simulacao && <span className="rounded bg-superficie-2 px-1.5 text-apagado">simulação</span>}
                      {contato && (
                        <Link href={`/contatos/${contato.id}`} className="text-suave hover:text-texto">
                          {nomeDoContato(contato)}
                        </Link>
                      )}
                      <span className="text-apagado">{haQuanto(t.criado_em)}</span>
                      <span className="text-apagado">US$ {Number(t.custo_usd ?? 0).toFixed(4)}</span>
                    </div>
                    {t.entrada && <p className="mt-1 line-clamp-2 text-suave">↳ {t.entrada}</p>}
                    {t.resposta?.length ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{(t.resposta as string[]).join("\n")}</p> : null}
                    {t.motivo && <p className="mt-1 text-xs text-apagado">{t.motivo}</p>}
                    {avisos && <p className="mt-1 text-xs text-morno">auditor: {avisos}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section id="versoes" className="scroll-mt-6">
          <h2 className="mb-3 rotulo">Versões do prompt</h2>
          {!versoes?.length ? (
            <p className="card p-4 text-sm text-suave">Nenhuma versão salva: ele está usando o prompt padrão do sistema.</p>
          ) : (
            <ul className="space-y-2">
              {versoes.map((v, i) => (
                <li key={v.id} className="card p-3 text-sm">
                  <p className="text-xs text-apagado">
                    {dataCurta(v.criado_em)} {i === 0 && <span className="text-ok">· em uso</span>}
                    {!v.prompt && <span> · padrão do sistema</span>}
                  </p>
                  <p className="mt-0.5">{v.nota ?? "sem nota"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {v.prompt && (
                      <details className="w-full">
                        <summary className="cursor-pointer text-xs text-suave">ver o texto</summary>
                        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-superficie-2 p-2 font-mono text-[11px] text-suave">
                          {v.prompt}
                        </pre>
                      </details>
                    )}
                    {i > 0 && (
                      <form action={restaurarVersao}>
                        <input type="hidden" name="versao_id" value={v.id} />
                        <button className="text-xs text-marca underline">Voltar pra esta</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
