import { haQuanto } from "@/lib/formato";
import { MOTORES, nomeDoMotor, type BatidaEstacao, type ConfigEditor } from "@/lib/editor";
import { salvarMotor } from "./acoes";

/** O que a estação disse da última vez que conferiu o motor (instalado? logado? com crédito?). */
function StatusDoMotor({ config, batida }: { config: ConfigEditor; batida: BatidaEstacao | null }) {
  if (!batida?.motor_conferido_em || !batida.motor)
    return <p className="text-xs text-apagado">Quando a estação ligar, ela confere se o programa está instalado e logado no seu PC e mostra aqui.</p>;
  const quando = haQuanto(batida.motor_conferido_em);
  if (batida.motor !== config.motor)
    return (
      <p className="text-xs text-apagado">
        A estação ainda está com o {nomeDoMotor(batida.motor)}. Ligada, ela confere a sua escolha em até 1 minuto (o próximo vídeo já sai com o{" "}
        {nomeDoMotor(config.motor)}).
      </p>
    );
  if (batida.motor_ok)
    return (
      <div className="space-y-1 text-xs">
        <p className="text-ok">
          ✓ A estação{batida.maquina ? ` (${batida.maquina})` : ""} conferiu {quando}: o {nomeDoMotor(batida.motor)} está pronto pra editar.
        </p>
        {batida.motor_aviso && <p className="text-morno">Atenção: {batida.motor_aviso}.</p>}
      </div>
    );
  return (
    <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">
      A estação{batida.maquina ? ` (${batida.maquina})` : ""} não consegue editar com o {nomeDoMotor(batida.motor)} ({quando}): {batida.motor_erro ?? "erro sem detalhe"}. Os
      vídeos esperam na fila até resolver.
    </p>
  );
}

/** "Quem edita os seus vídeos": Claude (plano), ChatGPT (plano) ou OpenRouter (paga por vídeo). */
export function QuemEdita({ config, batida, salvo = false }: { config: ConfigEditor; batida: BatidaEstacao | null; salvo?: boolean }) {
  return (
    <section id="motor" className="card scroll-mt-6 space-y-3 p-4">
      <div>
        <h2 className="rotulo">Quem edita os seus vídeos</h2>
        <p className="mt-1 text-sm text-suave">A IA que monta a edição no seu PC. Escolha a que você já paga: dá pra trocar quando quiser.</p>
      </div>
      <form action={salvarMotor} className="space-y-2">
        {MOTORES.map((m) => (
          <label key={m.id} className="flex cursor-pointer gap-3 rounded-lg border border-borda p-3 hover:border-marca has-checked:border-marca">
            <input type="radio" name="motor" value={m.id} defaultChecked={config.motor === m.id} className="mt-1 accent-marca" />
            <span className="min-w-0">
              <b>{m.nome}</b> <span className="text-suave">· {m.quem}</span>
              <span className="mt-0.5 block text-xs text-apagado">{m.como}</span>
            </span>
          </label>
        ))}
        <details className="text-xs text-apagado">
          <summary className="cursor-pointer">Avançado: escolher o modelo</summary>
          <input
            name="modelo"
            defaultValue={config.modelo ?? ""}
            maxLength={100}
            className="campo mt-2"
            placeholder="vazio = o padrão (Claude: opus · ChatGPT: o da sua conta · OpenRouter: anthropic/claude-sonnet-5.5)"
          />
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-sm">
            Salvar
          </button>
          {salvo && <span className="text-xs text-ok">Salvo ✓ O próximo vídeo já sai com essa escolha.</span>}
        </div>
      </form>
      <StatusDoMotor config={config} batida={batida} />
    </section>
  );
}
