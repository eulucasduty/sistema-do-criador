"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Midia } from "@/lib/instagram/api";
import { salvarAutomacao } from "./acoes";

type MensagemEntrega = { texto?: string; botao_titulo?: string; botao_url?: string };

export type AutomacaoForm = {
  id?: string;
  nome?: string;
  modo?: string;
  contexto?: string | null;
  todas_as_midias?: boolean;
  midias?: string[];
  palavras?: string[];
  respostas_publicas?: string[];
  dm_abertura?: string;
  botao_abertura?: string;
  exigir_seguir?: boolean;
  dm_nao_segue?: string | null;
  botao_seguir?: string | null;
  entrega_mensagens?: MensagemEntrega[];
  dm_entrega?: string | null;
  link_entrega?: string | null;
  tag?: string | null;
  followups?: Array<{ horas: number; texto: string }>;
};

// Uma automação nova já vem preenchida com um fluxo que funciona (é só trocar o link)
const PADRAO: AutomacaoForm = {
  modo: "botao",
  respostas_publicas: ["te mandei no direct 🔥", "olha seu direct!", "mandei lá, confere 👀"],
  dm_abertura: "oi! vi seu comentário 👋 quer que eu te mande o material?",
  botao_abertura: "quero",
  exigir_seguir: false,
  dm_nao_segue: "Pra te mandar o material, preciso que você me siga! Me segue e toca no botão aqui embaixo 👇",
  botao_seguir: "Já segui ✅",
  entrega_mensagens: [{ texto: "tá aqui o que eu prometi 👇\n{link}" }],
  followups: [
    { horas: 12, texto: "{nome}?" },
    { horas: 23, texto: "?" },
  ],
};

const MAX_ENTREGA = 6;

function Passo({ n, titulo, children, dica }: { n: number; titulo: string; children: React.ReactNode; dica?: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border-2 border-linha p-4">
      <legend className="flex items-center gap-2 px-1">
        <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-tinta bg-marca font-display text-xs text-[#05070e]">{n}</span>
        <span className="font-display text-sm uppercase tracking-wide">{titulo}</span>
      </legend>
      {dica && <p className="mb-3 text-xs text-apagado">{dica}</p>}
      {children}
    </fieldset>
  );
}

export function FormularioAutomacao({
  a: salva,
  midias,
  erroMidias,
  agenteLigado,
}: {
  a?: AutomacaoForm;
  midias: Midia[];
  erroMidias: string | null;
  agenteLigado: boolean;
}) {
  const nova = !salva?.id;
  const a: AutomacaoForm = nova ? { ...PADRAO, ...(salva ?? {}) } : (salva ?? {});
  const escolhidas = new Set(a.midias ?? []);
  const recentes = new Set(midias.map((m) => m.id));
  const antigas = (a.midias ?? []).filter((id) => !recentes.has(id));
  // Automação antiga (mensagem de entrega única) aparece como 1ª mensagem da sequência
  const entrega: MensagemEntrega[] = a.entrega_mensagens?.length ? a.entrega_mensagens : a.dm_entrega ? [{ texto: a.dm_entrega }] : [];

  const [modo, setModo] = useState(a.modo === "agente" ? "agente" : "botao");
  const [qtdEntrega, setQtdEntrega] = useState(Math.max(1, entrega.length));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setErro(null);
    iniciar(async () => {
      const r = await salvarAutomacao(dados);
      if (r?.erro) setErro(r.erro);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-5 text-sm">
      {a.id && <input type="hidden" name="id" value={a.id} />}

      <label className="block">
        <span className="rotulo">Nome (só pra você)</span>
        <input name="nome" required maxLength={80} defaultValue={a.nome ?? ""} placeholder="Reel das 5 ferramentas · palavra LISTA" className="campo mt-1" />
      </label>

      <Passo n={1} titulo="Gatilho" dica="Quem comentar uma dessas palavras nos posts escolhidos entra na automação. Sem palavra = qualquer comentário.">
        <input
          name="palavras"
          defaultValue={(a.palavras ?? []).join(", ")}
          placeholder="LISTA, quero (separe por vírgula; maiúscula e acento não importam)"
          className="campo"
        />
        <label className="mt-3 flex items-center gap-2">
          <input type="checkbox" name="todas_as_midias" defaultChecked={a.todas_as_midias} /> Em todos os posts (inclusive os próximos)
        </label>
        {antigas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-suave">
            {antigas.map((id) => (
              <label key={id} className="flex items-center gap-1.5">
                <input type="checkbox" name="midias" value={id} defaultChecked /> post mais antigo ({id.slice(-6)})
              </label>
            ))}
          </div>
        )}
        {erroMidias ? (
          <p className="mt-2 text-xs text-morno">{erroMidias}</p>
        ) : !midias.length ? (
          <p className="mt-2 text-xs text-apagado">Nenhum post na conta ainda.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {midias.map((m) => (
              <li key={m.id}>
                <label className="block cursor-pointer">
                  <input type="checkbox" name="midias" value={m.id} defaultChecked={escolhidas.has(m.id)} className="peer sr-only" />
                  <div className="overflow-hidden rounded-lg border-2 border-transparent opacity-50 transition peer-checked:border-marca peer-checked:opacity-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.thumbnail_url ?? m.media_url} alt="" loading="lazy" className="aspect-[9/16] w-full bg-superficie-2 object-cover" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-apagado">{m.caption?.slice(0, 60) || new Date(m.timestamp).toLocaleDateString("pt-BR")}</p>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Passo>

      <Passo n={2} titulo="Resposta no comentário" dica="Uma por linha: o sistema sorteia uma pra cada comentário (parece menos robô). {nome} vira o usuário da pessoa. Vazio = não responde em público.">
        <textarea name="respostas_publicas" rows={3} defaultValue={(a.respostas_publicas ?? []).join("\n")} className="campo" />
      </Passo>

      <Passo n={3} titulo="1ª DM" dica="A mensagem privada que chega na hora do comentário. O Instagram só deixa mandar a próxima depois que a pessoa responder.">
        <textarea name="dm_abertura" rows={2} required maxLength={1000} defaultValue={a.dm_abertura ?? ""} className="campo" />
        <label className="mt-2 block">
          <span className="text-xs text-apagado">
            Botão da 1ª DM (até 20 letras){modo === "agente" ? ": no modo agente vai sem botão e a pessoa responde escrevendo" : ""}
          </span>
          <input name="botao_abertura" maxLength={20} defaultValue={a.botao_abertura ?? "quero"} className="campo mt-1 max-w-xs" />
        </label>
      </Passo>

      <Passo
        n={4}
        titulo="Só pra quem te segue (opcional)"
        dica="Depois da resposta: se a pessoa não te segue, vai esta mensagem com o botão. Enquanto ela não seguir, a mesma mensagem volta a cada toque."
      >
        <label className="flex items-center gap-2">
          <input type="checkbox" name="exigir_seguir" defaultChecked={a.exigir_seguir} /> Só entregar pra quem me segue
        </label>
        <textarea name="dm_nao_segue" rows={2} maxLength={1000} defaultValue={a.dm_nao_segue ?? ""} className="campo mt-2" />
        <label className="mt-2 block">
          <span className="text-xs text-apagado">Texto do botão (até 20 letras)</span>
          <input name="botao_seguir" maxLength={20} defaultValue={a.botao_seguir ?? "Já segui ✅"} className="campo mt-1 max-w-xs" />
        </label>
      </Passo>

      <Passo
        n={5}
        titulo="Entrega"
        dica="As mensagens saem em sequência, com “digitando…” no meio. Qualquer uma pode ter um botão com link (o clique é contado). {link} = o link do material · {nome} = o usuário da pessoa."
      >
        <label className="block">
          <span className="text-xs text-apagado">Link do material (Drive, Notion, página… precisa começar com https://)</span>
          <input name="link_entrega" defaultValue={a.link_entrega ?? ""} placeholder="https://…" className="campo mt-1" />
        </label>
        <ol className="mt-3 space-y-3">
          {Array.from({ length: qtdEntrega }, (_, i) => entrega[i] ?? {}).map((m, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[28px_1fr_140px_1fr]">
              <span className="pt-2 font-mono text-xs text-apagado">{i + 1}.</span>
              <textarea
                name={`entrega_${i}_texto`}
                rows={2}
                maxLength={1000}
                defaultValue={m.texto ?? ""}
                placeholder={i === 0 ? "a mensagem" : "(vazio = não manda)"}
                className="campo"
              />
              <input name={`entrega_${i}_botao_titulo`} maxLength={20} defaultValue={m.botao_titulo ?? ""} placeholder="botão (opcional)" className="campo" />
              <input name={`entrega_${i}_botao_url`} defaultValue={m.botao_url ?? ""} placeholder="https://… (link do botão)" className="campo" />
            </li>
          ))}
        </ol>
        {qtdEntrega < MAX_ENTREGA && (
          <button type="button" onClick={() => setQtdEntrega((n) => n + 1)} className="mt-2 text-xs text-marca hover:underline">
            + Mais uma mensagem
          </button>
        )}
      </Passo>

      <Passo n={6} titulo="Depois da entrega">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-2 rounded-xl border-2 border-linha p-3 has-[:checked]:border-marca">
            <input type="radio" name="modo" value="botao" checked={modo === "botao"} onChange={() => setModo("botao")} className="mt-1" />
            <span>
              <b>Termina na entrega</b> <span className="text-xs text-apagado">(padrão)</span>
              <span className="block text-xs text-suave">A 1ª DM vai com o botão e a automação acaba no material. Se a pessoa responder, é com você.</span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-2 rounded-xl border-2 border-linha p-3 has-[:checked]:border-marca">
            <input type="radio" name="modo" value="agente" checked={modo === "agente"} onChange={() => setModo("agente")} className="mt-1" />
            <span>
              <b>O agente de IA continua</b>
              <span className="block text-xs text-suave">A 1ª DM vai sem botão. Depois da entrega, quando a pessoa responder, o agente conversa com ela.</span>
            </span>
          </label>
        </div>
        {modo === "agente" && !agenteLigado && (
          <p className="mt-2 text-xs text-morno">
            O agente está desligado: a conversa para na entrega até você ligar em <Link href="/agente" className="underline">Agente</Link>.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="text-xs text-apagado">O que tem no material (o agente usa pra conversar)</span>
            <textarea
              name="contexto"
              rows={2}
              maxLength={2000}
              defaultValue={a.contexto ?? ""}
              placeholder="ex.: lista com 5 ferramentas de IA grátis pra editar vídeo, com o link de cada uma"
              className="campo mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-apagado">Etiqueta no lead (quando recebe o material)</span>
            <input name="tag" maxLength={40} defaultValue={a.tag ?? ""} placeholder="lista_ferramentas" className="campo mt-1" />
          </label>
        </div>
      </Passo>

      <Passo
        n={7}
        titulo="Toque em quem sumiu"
        dica="Quem recebeu o material e não respondeu mais recebe esses toques. As horas contam da última mensagem da pessoa e o Instagram só deixa mandar até 24 h depois dela. Se ela responder, os toques param. {nome} vira o nome dela. Vazio = sem esse toque."
      >
        <div className="space-y-2">
          {[0, 1, 2].map((i) => {
            const t = a.followups?.[i];
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="rotulo w-14 shrink-0">{i + 1}º toque</span>
                <input
                  name={`followup_${i}_horas`}
                  type="number"
                  min={1}
                  max={23.5}
                  step={0.5}
                  defaultValue={t?.horas ?? ""}
                  placeholder="h"
                  className="campo w-20"
                />
                <span className="shrink-0 text-xs text-apagado">h depois</span>
                <input name={`followup_${i}_texto`} maxLength={300} defaultValue={t?.texto ?? ""} placeholder="{nome}?" className="campo" />
              </div>
            );
          })}
        </div>
      </Passo>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={salvando} className="btn">
          {salvando ? "Salvando…" : a.id ? "Salvar" : "Criar (desligada)"}
        </button>
        {erro && <span className="text-sm text-quente">{erro}</span>}
      </div>
    </form>
  );
}
