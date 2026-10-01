import Link from "next/link";
import { lerSituacao } from "@/lib/passos";
import { haQuanto } from "@/lib/formato";
import { Copiar } from "./copiar";
import { PassoEstacao } from "./editor/passo-estacao";
import { conectarInstagram, ligarRelogio, salvarChaveIA, salvarSegredoDoApp, testarIA } from "./conexoes/acoes";

// Início: o passo a passo pra deixar tudo ligado, com o status de cada coisa ao vivo.
// Quando tudo estiver pronto, os passos fecham e fica só o resumo.

export const dynamic = "force-dynamic";

type Estado = "ok" | "falta" | "opcional" | "atencao";

const SELO: Record<Estado, { texto: string; classe: string }> = {
  ok: { texto: "pronto", classe: "bg-ok/15 text-ok" },
  falta: { texto: "falta", classe: "bg-morno/15 text-morno" },
  atencao: { texto: "atenção", classe: "bg-quente/15 text-quente" },
  opcional: { texto: "opcional", classe: "bg-superficie-2 text-apagado" },
};

function Passo(props: { id: string; n: number; titulo: string; estado: Estado; resumo: React.ReactNode; aberto?: boolean; children?: React.ReactNode }) {
  const selo = SELO[props.estado];
  return (
    <details id={props.id} open={props.aberto ?? props.estado === "falta"} className="card group scroll-mt-6 p-0">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-tinta font-mono text-sm font-bold ${
            props.estado === "ok" ? "bg-ok text-[#05070e]" : "bg-superficie-2"
          }`}
        >
          {props.estado === "ok" ? "✓" : props.n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{props.titulo}</span>
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${selo.classe}`}>{selo.texto}</span>
          </span>
          <span className="mt-0.5 block text-sm text-suave">{props.resumo}</span>
        </span>
        <span className="text-apagado transition group-open:rotate-90">›</span>
      </summary>
      {props.children && <div className="space-y-3 border-t border-borda px-4 pb-4 pt-3 text-sm text-suave">{props.children}</div>}
    </details>
  );
}

function Codigo({ valor, segredo = false }: { valor: string; segredo?: boolean }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <code className="max-w-full overflow-x-auto rounded-md bg-superficie-2 px-2 py-1 font-mono text-xs text-texto">{valor}</code>
      <Copiar texto={valor} rotulo={segredo ? "Copiar (é segredo)" : "Copiar"} className="text-xs text-marca underline" />
    </span>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "erro"; children: React.ReactNode }) {
  return <p className={`rounded-lg px-3 py-2 text-sm ${tipo === "ok" ? "bg-ok/10 text-ok" : "bg-quente/10 text-quente"}`}>{children}</p>;
}

const Passos = ({ children }: { children: React.ReactNode }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>;
const T = ({ children }: { children: React.ReactNode }) => <b className="text-texto">{children}</b>;

export default async function Inicio({ searchParams }: PageProps<"/">) {
  const q = await searchParams;
  const s = await lerSituacao();

  const estados: Record<string, Estado> = {
    ia: s.env.openrouter ? "ok" : "falta",
    perfil: s.perfil.nicho && s.perfil.publico ? "ok" : "falta",
    instagram: s.instagram.token && s.env.appSecret && s.env.verifyToken && s.ultimoEventoIg ? "ok" : s.instagram.erro ? "atencao" : "falta",
    relogio: s.relogioBatendo ? "ok" : "falta",
    estacao: s.estacaoLigada ? "ok" : s.estacao.visto_em ? "atencao" : "falta",
    automacao: s.automacoesAtivas > 0 ? "ok" : "falta",
    facebook: s.facebook.page_token && !s.facebook.erro ? "ok" : s.facebook.erro ? "atencao" : "opcional",
    persona: s.persona.guia ? "ok" : "opcional",
    agente: s.agenteAtivo ? "ok" : "opcional",
  };
  const obrigatorios = ["ia", "perfil", "instagram", "relogio", "estacao", "automacao"];
  const prontos = obrigatorios.filter((k) => estados[k] === "ok").length;
  const tudoPronto = prontos === obrigatorios.length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="titulo">{s.perfil.nome ? `E aí, ${s.perfil.nome}` : "Bem-vindo"}</h1>
        <p className="mt-1 text-sm text-suave">
          {tudoPronto
            ? "Tudo ligado. Os passos ficam aqui embaixo pra consulta."
            : `Passo a passo pra deixar o sistema rodando: ${prontos} de ${obrigatorios.length} prontos. Cada passo mostra o status ao vivo.`}
        </p>
        <div className="xpbar mt-3 max-w-sm">
          <i style={{ width: `${(prontos / obrigatorios.length) * 100}%` }} />
        </div>
      </div>

      {s.alertasAbertos > 0 && (
        <Link href="/contatos?alertas=1" className="card flex items-center justify-between gap-3 border-quente p-4">
          <span>
            <span className="font-bold text-quente">{s.alertasAbertos} {s.alertasAbertos === 1 ? "lead precisa" : "leads precisam"} de você</span>
            <span className="block text-sm text-suave">O agente passou a conversa pra você, alguém quer comprar ou perguntou se é IA.</span>
          </span>
          <span className="btn btn-sm shrink-0">Ver</span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/esteira" className="card p-4 hover:border-marca">
          <span className="rotulo">Esteira</span>
          <span className="mt-1 block text-sm">Cole o link de um reel ou carrossel que bombou: a IA desmonta e escreve a sua versão.</span>
        </Link>
        <Link href="/editor/nova" className="card p-4 hover:border-marca">
          <span className="rotulo">Editor de vídeo</span>
          <span className="mt-1 block text-sm">Suba o vídeo cru + prints: volta editado, com legenda, motion e som.</span>
        </Link>
        <Link href="/instagram" className="card p-4 hover:border-marca">
          <span className="rotulo">Automações</span>
          <span className="mt-1 block text-sm">Comentou a palavra, recebe o material na DM. Sem ManyChat.</span>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg uppercase tracking-wide">Passo a passo</h2>

        <Passo
          id="hospedagem"
          n={1}
          titulo="Banco e hospedagem"
          estado="ok"
          aberto={false}
          resumo={`Se você está vendo esta tela, o Supabase e a hospedagem estão funcionando. Endereço do sistema: ${s.url}`}
        >
          <p>
            Já feito na instalação: o projeto no Supabase com o SQL rodado e o sistema publicado na Vercel com as 3 chaves do Supabase. Daqui pra
            frente, tudo é colado aqui mesmo no painel.
          </p>
          {!s.env.appUrl && (
            <p className="text-morno">
              Fora da Vercel: preencha a variável <T>APP_URL</T> com o endereço público (https://…), senão os links das automações e o relógio
              não funcionam.
            </p>
          )}
        </Passo>

        <Passo
          id="ia"
          n={2}
          titulo="Chave da IA (OpenRouter)"
          estado={estados.ia}
          resumo={s.env.openrouter ? "Configurada. A IA analisa referências, escreve roteiros e conversa no direct." : "Falta a chave: sem ela a Esteira e o agente não funcionam."}
        >
          {q.ia === "ok" && <Aviso tipo="ok">Chave ok: {String(q.msg ?? "")}.</Aviso>}
          {q.ia === "erro" && <Aviso tipo="erro">{String(q.msg ?? "")}</Aviso>}
          <p>A OpenRouter é uma loja de IAs: uma conta só, você paga só o que usar. É ela que assiste os vídeos e escreve pra você.</p>
          <Passos>
            <li>
              Entre em <T>openrouter.ai</T> e crie a conta (dá pra entrar com o Google).
            </li>
            <li>
              Clique na sua foto → <T>Credits</T> → <T>Add Credits</T> e coloque US$ 5 (duram bastante: analisar um reel custa centavos).
            </li>
            <li>
              Clique na sua foto → <T>Keys</T> → <T>Create Key</T> → dê um nome (ex.: sistema) → <T>Create</T>. Copie a chave (começa com{" "}
              <span className="font-mono">sk-or-</span>) e cole aqui:
              <form action={salvarChaveIA} className="mt-2 flex gap-2">
                <input type="hidden" name="voltar" value="/" />
                <input name="chave" type="password" placeholder="sk-or-…" className="campo font-mono" autoComplete="off" />
                <button className="btn btn-sm btn-2 shrink-0">{s.env.openrouter ? "Trocar" : "Salvar"}</button>
              </form>
            </li>
          </Passos>
          {s.env.openrouter && (
            <form action={testarIA}>
              <input type="hidden" name="voltar" value="/" />
              <button className="btn btn-sm btn-2">Testar a chave</button>
            </form>
          )}
        </Passo>

        <Passo
          id="perfil"
          n={3}
          titulo="Seu perfil"
          estado={estados.perfil}
          resumo={
            estados.perfil === "ok"
              ? `${s.perfil.usuario ? `@${s.perfil.usuario} · ` : ""}${s.perfil.nicho}`
              : "Conte quem você é, o seu nicho e o seu público: a IA escreve pra você a partir disso."
          }
        >
          <p>
            Em <Link href="/perfil" className="text-marca underline">Meu perfil</Link>: nome, nicho, público, jeito de falar, o look do vídeo e as cores
            da sua marca. O @ e a foto vêm sozinhos quando você conecta o Instagram.
          </p>
        </Passo>

        <Passo
          id="instagram"
          n={4}
          titulo="Instagram (o seu app na Meta)"
          estado={estados.instagram}
          resumo={
            estados.instagram === "ok"
              ? `@${s.instagram.username} conectado · último evento ${haQuanto(s.ultimoEventoIg?.recebido_em)}`
              : s.instagram.erro
                ? `Atenção: ${s.instagram.erro}`
                : "O passo mais longo (uns 20 min, uma vez só). É o que liga as automações, o agente e a sua persona."
          }
        >
          {q.ig === "ok" && <Aviso tipo="ok">Instagram conectado e inscrito nos webhooks.</Aviso>}
          {q.ig === "segredo" && <Aviso tipo="ok">Chave secreta do app salva.</Aviso>}
          {(q.ig === "erro" || q.ig === "parcial") && <Aviso tipo="erro">{q.ig === "parcial" ? "Conectou, mas: " : "Não conectou: "}{String(q.msg ?? "")}</Aviso>}
          <p>
            A Meta não deixa sistema nenhum mexer na sua conta sem um app seu. É de graça e fica no seu nome: ninguém mais tem acesso.
          </p>
          <Passos>
            <li>
              No app do Instagram: <T>Configurações → Tipo de conta e ferramentas → Mudar para conta profissional</T> (Criador de conteúdo ou
              Empresa). Se já é, pule.
            </li>
            <li>
              Em <T>developers.facebook.com</T>, entre com o seu Facebook → <T>Meus apps → Criar app</T> → escolha o caso de uso{" "}
              <T>Gerenciar mensagens e conteúdo no Instagram</T> → dê um nome (ex.: Creator System) → criar.
            </li>
            <li>
              No app da Meta: <T>Casos de uso → Instagram → Personalizar → Configuração da API com login do Instagram</T>.
            </li>
            <li>
              No topo dessa tela aparece a <T>Chave secreta do app do Instagram</T>: clique em <T>Mostrar</T>, copie e cole aqui (é o que prova que
              os avisos vêm mesmo da Meta):
              <form action={salvarSegredoDoApp} className="mt-2 flex gap-2">
                <input type="hidden" name="voltar" value="/" />
                <input name="segredo" type="password" placeholder="chave secreta do app (32 letras e números)" className="campo font-mono" autoComplete="off" />
                <button className="btn btn-sm btn-2 shrink-0">{s.env.appSecret ? "Trocar" : "Salvar"}</button>
              </form>
              {s.env.appSecret && <span className="mt-1 block text-ok">✓ chave secreta salva</span>}
            </li>
            <li>
              Em <T>Gerar tokens de acesso</T>: <T>Adicionar conta</T> → entre com o seu Instagram → aceite as permissões → <T>Gerar token</T>. Copie
              o token (começa com IGAA) e cole aqui:
              <form action={conectarInstagram} className="mt-2 flex gap-2">
                <input type="hidden" name="voltar" value="/" />
                <input name="token" type="password" placeholder="token do Instagram (IGAA…)" className="campo font-mono" />
                <button className="btn btn-sm btn-2 shrink-0">{s.instagram.token ? "Trocar" : "Conectar"}</button>
              </form>
              {s.instagram.token && <span className="mt-1 block text-ok">✓ @{s.instagram.username} conectado (o token renova sozinho)</span>}
            </li>
            <li>
              Em <T>Configurar webhooks</T>:
              <span className="mt-1 block">URL de callback:</span>
              <Codigo valor={`${s.url}/api/webhooks/instagram`} />
              <span className="mt-1 block">Token de verificação:</span>
              {s.tokenWebhook ? <Codigo valor={s.tokenWebhook} /> : <span className="block text-quente">falta a chave secreta do Supabase na hospedagem</span>}
              <span className="mt-1 block">
                Clique em <T>Verificar e salvar</T> e depois ative os campos <T>comments</T>, <T>messages</T>, <T>messaging_postbacks</T> e{" "}
                <T>message_reactions</T>.
              </span>
            </li>
            <li>
              Em <T>Configurações do app → Básico</T>: em “URL da Política de Privacidade” e em “URL de exclusão de dados”, coloque:
              <Codigo valor={`${s.url}/privacidade`} />
              Escolha uma categoria, ponha um ícone e salve.
            </li>
            <li>
              Publique o app: no topo, troque o modo de <T>Desenvolvimento</T> pra <T>Ao vivo</T> (Publicar). Sem isso, só os comentários de quem tem
              função no app chegam.
            </li>
            <li>
              Teste: comente qualquer coisa num post seu com outra conta. Esse passo fica verde quando o primeiro evento chegar
              {s.ultimoEventoIg ? <span className="text-ok"> (último: {haQuanto(s.ultimoEventoIg.recebido_em)})</span> : null}.
            </li>
          </Passos>
        </Passo>

        <Passo
          id="relogio"
          n={5}
          titulo="O relógio (o que roda sozinho)"
          estado={estados.relogio}
          resumo={
            s.relogioBatendo
              ? `Batendo (${s.relogio.modo === "servidor" ? "no servidor" : "pelo Supabase"}, último ${haQuanto(s.relogio.visto_em)})`
              : "Liga as respostas do agente, os lembretes das automações e as rotinas. É um clique."
          }
        >
          {q.relogio === "ok" && <Aviso tipo="ok">Relógio ligado: o Supabase chama o sistema a cada minuto.</Aviso>}
          {q.relogio === "erro" && <Aviso tipo="erro">{String(q.msg ?? "")}</Aviso>}
          <p>
            Clique no botão. O Supabase passa a chamar o sistema a cada minuto pra ele fazer o que precisa sozinho (responder, lembrar, renovar).
          </p>
          <form action={ligarRelogio}>
            <input type="hidden" name="voltar" value="/" />
            <button className="btn btn-sm">{s.relogioAgendado ? "Ligar de novo" : "Ligar o relógio"}</button>
          </form>
          <p className="text-xs">
            Se der erro de extensão: no Supabase, Database → Extensions, ligue <T>pg_cron</T> e <T>pg_net</T> e clique de novo. Rodando num servidor
            próprio (Docker), use RELOGIO=ligado no lugar disso.
          </p>
        </Passo>

        <Passo
          id="estacao"
          n={6}
          titulo="Estação de edição (o seu PC)"
          estado={estados.estacao}
          resumo={
            s.estacaoLigada
              ? `Ligada em ${s.estacao.maquina ?? "seu PC"}${s.estacao.ocupada ? " · editando agora" : " · esperando pedidos"}`
              : s.estacao.visto_em
                ? `Desligada (vista ${haQuanto(s.estacao.visto_em)}). Ligue quando for editar.`
                : "O editor de vídeo roda no seu computador, com a IA que você já assina (Claude ou ChatGPT) ou pela OpenRouter. Instala com um comando."
          }
        >
          <PassoEstacao batida={s.estacao} endereco={s.url} />
        </Passo>

        <Passo
          id="automacao"
          n={7}
          titulo="Sua primeira automação"
          estado={estados.automacao}
          resumo={
            s.automacoesAtivas
              ? `${s.automacoesAtivas} ${s.automacoesAtivas === 1 ? "automação ligada" : "automações ligadas"}`
              : "“Comenta QUERO que eu te mando no direct”: o sistema responde o comentário e entrega o material na DM."
          }
        >
          <p>
            Em <Link href="/instagram" className="text-marca underline">Automações</Link>, crie uma: escolha o post (ou todos), a palavra, a resposta
            pública, a DM e o link do material. Dá pra exigir que a pessoa siga antes e mandar lembretes pra quem não abriu.
          </p>
        </Passo>

        <h2 className="pt-3 font-display text-lg uppercase tracking-wide">Opcionais</h2>

        <Passo
          id="facebook"
          n={8}
          titulo="Facebook (Esteira pelo link)"
          estado={estados.facebook}
          resumo={
            s.facebook.page_token
              ? s.facebook.erro
                ? `Atenção: ${s.facebook.erro}`
                : `Conectado pela página “${s.facebook.page_nome}”`
              : "Pra Esteira buscar o vídeo de um reel de outra conta só pelo link. Sem isso, você sobe o arquivo."
          }
        >
          <p>
            A Meta só libera post de outra conta pela API oficial com o login do Facebook ligado à sua página. O passo a passo (uns 5 min) está em{" "}
            <Link href="/conexoes#facebook" className="text-marca underline">Conexões → Facebook</Link>. Conta pessoal e reel com música licenciada
            não vêm: aí é subir o arquivo.
          </p>
        </Passo>

        <Passo
          id="persona"
          n={9}
          titulo="Sua persona"
          estado={estados.persona}
          resumo={
            s.persona.guia
              ? `Tirada de ${s.persona.reels ?? "?"} reels seus. Os roteiros saem na sua voz.`
              : "A IA assiste os seus últimos reels e escreve o guia da sua voz: ganchos, bordões, ritmo, CTA."
          }
        >
          <p>
            Em <Link href="/esteira" className="text-marca underline">Esteira → Minha persona</Link>, clique em atualizar (precisa do Instagram
            conectado). Dá pra editar o guia à mão depois.
          </p>
        </Passo>

        <Passo
          id="agente"
          n={10}
          titulo="Agente de IA no direct"
          estado={estados.agente}
          resumo={
            s.agenteAtivo
              ? `Ligado · ${s.ofertas} ${s.ofertas === 1 ? "oferta" : "ofertas"} cadastradas`
              : "Conversa com quem respondeu a automação, tira dúvida e oferece o seu link. Só se você quiser."
          }
        >
          <p>
            Em <Link href="/agente" className="text-marca underline">Agente de IA</Link>: cadastre as ofertas (produto, grupo, mentoria), a base de
            conhecimento e teste no simulador antes de ligar. Nas automações, o modo “agente” passa a conversa pra ele depois da entrega.
          </p>
        </Passo>
      </section>
    </div>
  );
}
