"use client";

import { useState, useTransition } from "react";
import { salvarPrompt, simular, type MensagemSimulada, type ResultadoSimulado } from "./acoes";

type Props = {
  promptSalvo: string;
  promptPadrao: string;
  contatos: Array<{ id: string; nome: string }>;
  /** `sequencia` = o que a automação manda antes do agente entrar (1ª DM, resposta, entrega). */
  automacoes: Array<{ id: string; nome: string; modo: string; sequencia: MensagemSimulada[] }>;
};

type Linha = MensagemSimulada & { meta?: ResultadoSimulado };

const ROTULO_PASSAGEM: Record<string, string> = {
  precisa_de_voce: "passou pra você",
  quer_comprar: "quer comprar → passou pra você",
  perguntou_se_e_ia: "perguntou se é IA → passou pra você",
};

export function EditorSimulador({ promptSalvo, promptPadrao, contatos, automacoes }: Props) {
  const [prompt, setPrompt] = useState(promptSalvo);
  const [salvo, setSalvo] = useState(promptSalvo);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, iniciarSalvar] = useTransition();

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [texto, setTexto] = useState("");
  const [contatoId, setContatoId] = useState("");
  const [automacaoId, setAutomacaoId] = useState("");
  const [usarEditor, setUsarEditor] = useState(true);
  const [pensando, iniciarPensar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const mudou = prompt.trim() !== salvo.trim();
  const custoConversa = linhas.reduce((s, l) => s + (l.meta?.custoUsd ?? 0), 0);

  function salvar() {
    iniciarSalvar(async () => {
      const r = await salvarPrompt(prompt, nota);
      if (r.ok) {
        const final = prompt.trim() === promptPadrao.trim() ? "" : prompt.trim();
        setPrompt(final);
        setSalvo(final);
        setNota("");
        setAviso({ ok: true, texto: "Salvo. A próxima resposta já usa esta versão." });
      } else setAviso({ ok: false, texto: `Não salvou: ${r.erro}` });
    });
  }

  function mandar(responder: boolean) {
    const t = texto.trim();
    const base: Linha[] = t ? [...linhas, { autor: "contato", texto: t }] : linhas;
    if (!base.length) return;
    setLinhas(base);
    setTexto("");
    setErro(null);
    if (!responder) return;
    iniciarPensar(async () => {
      const r = await simular({
        prompt: usarEditor ? prompt : null,
        mensagens: base.map(({ autor, texto, automacao }) => ({ autor, texto, automacao })),
        contatoId: contatoId || null,
        automacaoId: automacaoId || null,
      });
      if (!r.ok) {
        setErro(r.erro ?? "falhou");
        return;
      }
      const respostas: Linha[] = r.baloes.map((b, i) => ({ autor: "agente", texto: b, meta: i === r.baloes.length - 1 ? r : undefined }));
      // Sem balão (barrado, ou pediu pra sair): mostra só o que aconteceu
      setLinhas([...base, ...(respostas.length ? respostas : [{ autor: "agente" as const, texto: "", meta: r }])]);
    });
  }

  function escolherAutomacao(id: string) {
    setAutomacaoId(id);
    setErro(null);
    setLinhas(automacoes.find((x) => x.id === id)?.sequencia ?? []);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="rotulo">Prompt {salvo ? "(seu)" : "(padrão do sistema)"}</h3>
          <span className="text-xs text-apagado">{(prompt || promptPadrao).length.toLocaleString("pt-BR")} caracteres</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setAviso(null);
          }}
          placeholder={promptPadrao}
          spellCheck={false}
          className="card h-[60vh] w-full resize-y p-3 font-mono text-[12.5px] leading-relaxed outline-none placeholder:text-apagado focus:border-marca"
        />
        <p className="mt-1 text-xs text-apagado">
          Vazio = usa o padrão do sistema (o texto apagado aí em cima). Quem você é, as ofertas e a base de conhecimento entram sozinhos.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={200}
            placeholder="O que mudou (fica no histórico)"
            className="campo min-w-0 flex-1"
          />
          <button onClick={salvar} disabled={!mudou || salvando} className="btn btn-sm">
            {salvando ? "Salvando…" : "Salvar versão"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {!prompt.trim() && (
            <button onClick={() => setPrompt(promptPadrao)} className="text-suave underline hover:text-texto">
              Começar a editar a partir do padrão
            </button>
          )}
          {prompt.trim() && (
            <button onClick={() => setPrompt("")} className="text-suave underline hover:text-texto">
              Restaurar o padrão
            </button>
          )}
          {mudou && (
            <button onClick={() => setPrompt(salvo)} className="text-suave underline hover:text-texto">
              Desfazer mudanças
            </button>
          )}
          {aviso && <span className={aviso.ok ? "text-ok" : "text-quente"}>{aviso.texto}</span>}
          {mudou && !aviso && <span className="text-morno">Não salvo: o agente ainda usa a versão salva.</span>}
        </div>
      </section>

      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="rotulo">Simulador</h3>
          {linhas.length > 0 && (
            <button
              onClick={() => {
                setLinhas(automacoes.find((x) => x.id === automacaoId)?.sequencia ?? []);
                setErro(null);
              }}
              className="text-xs text-suave underline hover:text-texto"
            >
              Recomeçar
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={contatoId} onChange={(e) => setContatoId(e.target.value)} className="campo min-w-0 flex-1">
            <option value="">Pessoa nova (sem ficha)</option>
            {contatos.map((c) => (
              <option key={c.id} value={c.id}>
                Como se fosse: {c.nome}
              </option>
            ))}
          </select>
          <select value={automacaoId} onChange={(e) => escolherAutomacao(e.target.value)} className="campo min-w-0 flex-1">
            <option value="">Sem automação (DM direta)</option>
            {automacoes.map((x) => (
              <option key={x.id} value={x.id}>
                Veio da automação: {x.nome}
                {x.modo === "agente" ? "" : " (modo botão)"}
              </option>
            ))}
          </select>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-suave">
          <input type="checkbox" checked={usarEditor} onChange={(e) => setUsarEditor(e.target.checked)} />
          testar com o texto do editor (mesmo sem salvar)
        </label>

        <ol className="card mt-3 h-[46vh] space-y-2 overflow-y-auto p-3">
          {!linhas.length && (
            <li className="p-2 text-sm text-apagado">
              Escreva como se fosse alguém no seu direct. Nada vai pro Instagram; só o custo da IA é de verdade.
            </li>
          )}
          {linhas.map((l, i) => (
            <li key={i} className={`flex flex-col ${l.autor === "agente" ? "items-end" : "items-start"}`}>
              {l.automacao && <span className="mb-0.5 text-[10px] uppercase tracking-wider text-apagado">automação</span>}
              {l.texto && (
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    l.autor === "agente" ? (l.automacao ? "bg-superficie-2 text-suave" : "bg-marca-fundo") : "bg-superficie-2"
                  }`}
                >
                  {l.texto}
                </div>
              )}
              {l.meta && <Meta r={l.meta} />}
            </li>
          ))}
          {pensando && <li className="text-right text-xs text-apagado">digitando…</li>}
        </ol>
        {erro && <p className="mt-2 text-xs text-quente">{erro}</p>}

        <div className="mt-2 flex gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!pensando) mandar(true);
              }
            }}
            rows={2}
            placeholder="Mensagem da pessoa… (Enter manda e o agente responde)"
            className="campo min-w-0 flex-1 resize-none"
          />
          <div className="flex flex-col gap-1">
            <button onClick={() => mandar(true)} disabled={pensando} className="btn btn-sm">
              Mandar
            </button>
            <button
              onClick={() => mandar(false)}
              disabled={pensando || !texto.trim()}
              title="Adiciona a mensagem sem o agente responder (pra simular várias mensagens seguidas)"
              className="btn btn-sm btn-2"
            >
              Só adicionar
            </button>
          </div>
        </div>
        {custoConversa > 0 && <p className="mt-1 text-right text-[11px] text-apagado">esta conversa: US$ {custoConversa.toFixed(4)}</p>}
      </section>
    </div>
  );
}

function Meta({ r }: { r: ResultadoSimulado }) {
  const chips: Array<{ texto: string; cor: string }> = [];
  if (r.gatilho) chips.push({ texto: r.gatilho, cor: "text-quente" });
  for (const p of r.passagens) chips.push({ texto: `${ROTULO_PASSAGEM[p.tipo] ?? p.tipo}: ${p.motivo}`, cor: "text-morno" });
  if (r.oferta) chips.push({ texto: `mandou a oferta “${r.oferta.nome}”: ${r.oferta.resumo}`, cor: "text-ok" });
  if (r.encerrou) chips.push({ texto: `encerrou: ${r.encerrou}`, cor: "text-suave" });
  if (r.saiu && !r.gatilho) chips.push({ texto: `pediu pra sair: ${r.saiu}`, cor: "text-quente" });
  if (r.bloqueado) chips.push({ texto: `barrado pelo auditor (não sairia): ${r.motivos.join(", ")}`, cor: "text-quente" });
  else if (r.tentativas > 1) chips.push({ texto: "o auditor mandou refazer 1 vez", cor: "text-morno" });
  for (const a of r.avisos) chips.push({ texto: `auditor: ${a}`, cor: "text-morno" });
  return (
    <div className="mt-1 max-w-[85%] space-y-0.5 text-right">
      {chips.map((c, i) => (
        <p key={i} className={`text-[11px] ${c.cor}`}>
          {c.texto}
        </p>
      ))}
      <p className="text-[11px] text-apagado">
        {r.ferramentas.length ? `ferramentas: ${r.ferramentas.join(", ")} · ` : ""}
        {r.segundos}s · US$ {r.custoUsd.toFixed(4)}
      </p>
    </div>
  );
}
