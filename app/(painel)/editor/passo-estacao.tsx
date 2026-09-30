import { REPO_URL, urlDoApp } from "@/lib/app";
import { haQuanto } from "@/lib/formato";
import { estacaoLigada, nomeDoMotor, type BatidaEstacao } from "@/lib/editor";
import { usuarioLogado } from "@/lib/supabase/server";
import { Copiar } from "../copiar";

// O corpo do passo "Estação de edição" do Início: instalar com uma linha só (Windows ou Mac),
// o que acontece e o que digitar na primeira vez. Os instaladores ficam em instalar/ no repositório.

const BRUTO = `${REPO_URL.replace("https://github.com/", "https://raw.githubusercontent.com/")}/main/instalar`;
export const COMANDO_WINDOWS = `irm ${BRUTO}/windows.ps1 | iex`;
export const COMANDO_MAC = `curl -fsSL ${BRUTO}/mac.sh | bash`;

function Linha({ valor }: { valor: string }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <code className="max-w-full overflow-x-auto rounded-md bg-superficie-2 px-2 py-1 font-mono text-xs text-texto">{valor}</code>
      <Copiar texto={valor} className="text-xs text-marca underline" />
    </span>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <b className="text-texto">{children}</b>;

/**
 * Passo 6 do Início. `batida`: a última batida da estação (configuracao "estacao_edicao").
 * `email` e `endereco` aparecem prontos pra copiar (sem eles: o login atual e urlDoApp()).
 */
export async function PassoEstacao({ batida = null, email, endereco }: { batida?: BatidaEstacao | null; email?: string | null; endereco?: string }) {
  const url = endereco ?? urlDoApp();
  const login = email === undefined ? (((await usuarioLogado())?.email as string | undefined) ?? null) : email;
  const ligada = estacaoLigada(batida);

  return (
    <div className="space-y-3">
      <p>
        A estação é o programa que edita os seus vídeos no seu computador (Windows ou Mac). Você sobe o vídeo pelo painel (até do celular), ela pega o
        pedido, trata cor e som, transcreve, a IA monta a edição e o vídeo pronto volta pro painel. Instala uma vez, com uma linha só.
      </p>

      <ol className="list-decimal space-y-3 pl-5">
        <li>
          <B>Windows:</B> abra o menu Iniciar, digite <B>PowerShell</B> e abra. Cole esta linha e aperte Enter:
          <Linha valor={COMANDO_WINDOWS} />
        </li>
        <li>
          <B>Mac:</B> abra o <B>Terminal</B> (⌘ + espaço, digite Terminal). Cole esta linha e aperte Enter:
          <Linha valor={COMANDO_MAC} />
        </li>
      </ol>

      <div>
        <p className="font-bold text-texto">O que vai acontecer</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Ele instala o que falta: Node.js, ffmpeg, o whisper (que transcreve a sua fala) e o modelo de transcrição. Na primeira vez baixa uns 2 GB e leva
            de 10 a 30 minutos. Se o Windows pedir permissão, clique em <B>Sim</B>; no Mac ele pode pedir a senha do computador.
          </li>
          <li>
            Pergunta <B>quem edita os seus vídeos</B>: Claude (se você assina o Claude Pro ou Max), ChatGPT (se assina o ChatGPT Plus ou Pro) ou
            OpenRouter (paga por vídeo, com a chave do passo 2). No Claude e no ChatGPT, abre o login no navegador: entre com a conta da sua assinatura.
          </li>
          <li>
            Cria o atalho <B>Estação de edição</B> na sua Área de Trabalho e já liga a estação.
          </li>
        </ul>
      </div>

      <div>
        <p className="font-bold text-texto">Na primeira vez, a estação pergunta:</p>
        <ul className="mt-1 space-y-2 pl-1">
          <li>
            Endereço do sistema: <Linha valor={url} />
          </li>
          <li>
            E-mail: {login ? <Linha valor={login} /> : <span>o mesmo que você usa pra entrar no painel</span>}
          </li>
          <li>
            Senha: a mesma do painel. Ela <B>não fica guardada</B> no PC: a estação guarda só a sessão, num arquivo que só o seu usuário abre.
          </li>
        </ul>
      </div>

      <p>
        Depois disso, é só abrir o atalho <B>Estação de edição</B> e deixar a janela aberta enquanto tiver vídeo na fila. Esse passo fica verde em até 30
        segundos. Pra atualizar, rode a mesma linha de novo (o seu login continua).
      </p>

      {batida?.motor && batida.motor_ok === false && (
        <p className="rounded-lg bg-quente/10 px-3 py-2 text-quente">
          A estação{ligada ? "" : batida.visto_em ? ` (vista ${haQuanto(batida.visto_em)})` : ""} não consegue editar com o {nomeDoMotor(batida.motor)}:{" "}
          {batida.motor_erro ?? "erro sem detalhe"}.
        </p>
      )}
      {batida?.motor && batida.motor_ok && batida.motor_aviso && <p className="text-morno">Atenção: {batida.motor_aviso}.</p>}

      <p className="text-xs">
        Prefere instalar na mão, ou deu algum problema? O guia completo:{" "}
        <a href={`${REPO_URL}/blob/main/editor/INSTALAR.md`} target="_blank" rel="noreferrer" className="text-marca underline">
          editor/INSTALAR.md
        </a>
        .
      </p>
    </div>
  );
}
