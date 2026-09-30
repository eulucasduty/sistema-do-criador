/* eslint-disable @next/next/no-img-element */
import { lerPerfil } from "@/lib/config";
import { atualizarDoInstagram, salvarPerfil } from "./acoes";

// Quem é você: a IA escreve a partir disso (roteiro, carrossel, agente) e o editor usa o
// seu @, a sua foto, o look do vídeo e o estilo de legenda.

export const dynamic = "force-dynamic";

const LOOKS = [
  { id: "natural", nome: "Natural", texto: "Só corrige (HDR do iPhone, nitidez leve). Bom pra quem já grava com luz boa." },
  { id: "quente", nome: "Quente", texto: "Um pouco mais de contraste e calor, pele saudável." },
  { id: "contraste", nome: "Contraste forte", texto: "Mais escuro e contrastado, com nitidez: o look de edição de criador." },
];

const LEGENDAS = [
  { id: "bangers", nome: "Impacto", texto: "Palavra por palavra, letra grossa e grande (estilo karaokê)." },
  { id: "limpa", nome: "Limpa", texto: "Legenda em caixa, mais discreta, com destaque na palavra." },
];

export default async function PaginaPerfil({ searchParams }: PageProps<"/perfil">) {
  const q = await searchParams;
  const p = await lerPerfil();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="titulo">Meu perfil</h1>
        <p className="mt-1 text-sm text-suave">A IA escreve pra você a partir daqui, e o editor de vídeo usa o seu @, a sua foto e o seu look.</p>
      </div>
      {q.salvo && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Salvo.</p>}
      {q.ig && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Atualizado com o que está no Instagram.</p>}
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      <section className="card flex items-center gap-4 p-4">
        {p.foto_url ? (
          <img src={p.foto_url} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl border-2 border-tinta object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-tinta bg-superficie-2 font-display text-2xl">
            {(p.nome ?? p.usuario ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">{p.usuario ? `@${p.usuario}` : "Instagram não conectado"}</p>
          <p className="text-suave">O @ e a foto vêm do Instagram (e se atualizam uma vez por dia).</p>
        </div>
        <form action={atualizarDoInstagram}>
          <button className="btn btn-sm btn-2">Atualizar</button>
        </form>
      </section>

      <form action={salvarPerfil} className="space-y-6">
        <section className="card space-y-4 p-4">
          <h2 className="font-display text-lg uppercase tracking-wide">Quem é você</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="rotulo">Seu nome (como você assina)</span>
              <input name="nome" defaultValue={p.nome ?? ""} placeholder="Ana" className="campo mt-1" />
            </label>
            <label className="block">
              <span className="rotulo">Seu @</span>
              <input name="usuario" defaultValue={p.usuario ?? ""} placeholder="seu.usuario" className="campo mt-1 font-mono" />
            </label>
          </div>
          <label className="block">
            <span className="rotulo">Nicho</span>
            <input name="nicho" defaultValue={p.nicho ?? ""} placeholder="ex.: finanças pra quem tá começando, treino em casa, IA pra negócios" className="campo mt-1" />
          </label>
          <label className="block">
            <span className="rotulo">Pra quem você fala</span>
            <textarea
              name="publico"
              rows={2}
              defaultValue={p.publico ?? ""}
              placeholder="ex.: jovens de 18 a 25 que querem a primeira renda extra; donos de pequenos negócios"
              className="campo mt-1"
            />
          </label>
          <label className="block">
            <span className="rotulo">Seu jeito de falar</span>
            <textarea
              name="tom"
              rows={3}
              defaultValue={p.tom ?? ""}
              placeholder="ex.: informal, animado, falo 'mano' e 'bizarro', explico como amigo e não como professor, sem palavrão"
              className="campo mt-1"
            />
            <span className="mt-1 block text-xs text-apagado">A persona tirada dos seus reels (Esteira) é mais precisa; isto aqui completa.</span>
          </label>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="font-display text-lg uppercase tracking-wide">Vídeo</h2>
          <fieldset>
            <legend className="rotulo">Look (cor do vídeo)</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {LOOKS.map((l) => (
                <label key={l.id} className="flex cursor-pointer gap-2 rounded-xl border-2 border-borda p-3 text-sm has-[:checked]:border-marca">
                  <input type="radio" name="cor" value={l.id} defaultChecked={p.cor === l.id} className="mt-1 accent-[var(--color-marca)]" />
                  <span>
                    <span className="font-bold">{l.nome}</span>
                    <span className="block text-xs text-suave">{l.texto}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="rotulo">Legenda padrão</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {LEGENDAS.map((l) => (
                <label key={l.id} className="flex cursor-pointer gap-2 rounded-xl border-2 border-borda p-3 text-sm has-[:checked]:border-marca">
                  <input type="radio" name="legenda" value={l.id} defaultChecked={p.legenda === l.id} className="mt-1 accent-[var(--color-marca)]" />
                  <span>
                    <span className="font-bold">{l.nome}</span>
                    <span className="block text-xs text-suave">{l.texto}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="card space-y-4 p-4">
          <h2 className="font-display text-lg uppercase tracking-wide">Cores da marca</h2>
          <p className="text-sm text-suave">Usadas no carrossel quando você escolhe o visual “minha marca”.</p>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["cor_fundo", "Fundo", p.cores.fundo],
                ["cor_texto", "Texto", p.cores.texto],
                ["cor_destaque", "Destaque", p.cores.destaque],
              ] as const
            ).map(([nome, rotulo, valor]) => (
              <label key={nome} className="flex items-center gap-2 text-sm">
                <input type="color" name={nome} defaultValue={valor} className="h-10 w-14 cursor-pointer rounded-lg border-2 border-tinta bg-transparent" />
                {rotulo}
              </label>
            ))}
          </div>
        </section>

        <button className="btn">Salvar</button>
      </form>
    </div>
  );
}
