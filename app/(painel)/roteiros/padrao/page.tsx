import Link from "next/link";
import { dataCurta } from "@/lib/formato";
import { regrasEmTexto } from "@/lib/roteiro/anti-ia.mjs";
import { lerPadrao } from "@/lib/roteiro/padrao-viral";
import { BotaoGerar } from "../../esteira/botoes";
import { restaurarPadraoViral, salvarPadraoViral } from "../acoes";

export const dynamic = "force-dynamic";

export default async function PaginaPadraoViral({ searchParams }: PageProps<"/roteiros/padrao">) {
  const q = await searchParams;
  const p = await lerPadrao();
  // um espaço em branco no fim pra colar um exemplo novo
  const exemplos = [...p.exemplos, { titulo: "", fonte: "", transcricao: "", por_que: "" }];

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/roteiros" className="text-xs text-suave hover:text-texto">
        ← Roteiros
      </Link>
      <header>
        <h1 className="titulo">Padrão viral</h1>
        <p className="mt-1 text-sm text-suave">
          O guia que o roteirista segue: as regras (gancho, estrutura, ritmo, vocabulário, CTA) e exemplos de fala de verdade de vídeos que performaram. É
          o exemplo real que tira a cara de IA: troque os exemplos ilustrativos pela transcrição de virais do seu nicho (a Esteira transcreve pra você, é
          só copiar de lá). A sua voz vem da sua persona (Esteira → Minha persona). {p.fonte ? `Agora: ${p.fonte}.` : ""}
          {p.atualizado_em ? ` Editado ${dataCurta(p.atualizado_em)}.` : ""}
        </p>
      </header>
      {q.salvo && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Salvo. Os próximos roteiros já usam.</p>}
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      <form action={salvarPadraoViral} className="space-y-4">
        <section className="card space-y-2 p-4">
          <h2 className="rotulo">Regras</h2>
          <textarea name="regras" defaultValue={p.regras} rows={18} className="campo font-mono text-xs leading-relaxed" />
        </section>

        <section className="card space-y-3 p-4">
          <div>
            <h2 className="rotulo">Exemplos de fala real</h2>
            <p className="mt-1 text-xs text-apagado">
              A transcrição de um vídeo que performou, uma ideia por linha. O roteirista copia o jeito, nunca as frases (a checagem barra trecho igual). Pra
              tirar um exemplo, apague a transcrição.
            </p>
          </div>
          {exemplos.map((e, i) => (
            <div key={i} className="space-y-2 rounded-xl border-2 border-linha p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="exemplo_titulo" defaultValue={e.titulo} placeholder={i === exemplos.length - 1 ? "exemplo novo: título" : "título"} className="campo" />
                <input name="exemplo_fonte" defaultValue={e.fonte} placeholder="de onde veio e como performou" className="campo" />
              </div>
              <textarea name="exemplo_transcricao" defaultValue={e.transcricao} rows={i === exemplos.length - 1 ? 3 : 8} placeholder="a fala, uma ideia por linha" className="campo text-sm" />
              <input name="exemplo_por_que" defaultValue={e.por_que} placeholder="por que funcionou" className="campo" />
            </div>
          ))}
        </section>

        <section className="card space-y-2 p-4">
          <h2 className="rotulo">Expressões que você proíbe</h2>
          <p className="text-xs text-apagado">Uma por linha. A checagem reprova o roteiro que usar e ele é reescrito.</p>
          <textarea name="proibidas" defaultValue={p.proibidas.join("\n")} rows={4} placeholder={"ex.: mindset\nfórmula mágica"} className="campo text-sm" />
        </section>

        <BotaoGerar rotulo="Salvar o padrão" gerando="Salvando…" className="btn w-full sm:w-auto" />
      </form>

      <details className="card p-4 text-sm">
        <summary className="rotulo cursor-pointer">O que a checagem anti-IA barra (sempre)</summary>
        <p className="mt-2 text-xs text-apagado">
          Cada roteiro passa por essa checagem e por um leitor que procura frase com cara de IA. O que reprovar volta pra IA reescrever (até 2 vezes).
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-suave">{regrasEmTexto(p.proibidas)}</pre>
      </details>

      <form action={restaurarPadraoViral}>
        <button className="text-xs text-apagado hover:text-quente">Voltar pro padrão do sistema</button>
      </form>
    </div>
  );
}
