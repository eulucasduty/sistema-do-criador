import { lerPerfil } from "@/lib/config";

// Política de privacidade e exclusão de dados — pública (a Meta exige pra publicar o app).
// O nome e o @ vêm do seu perfil.

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacidade" };

export default async function Privacidade() {
  let nome = "o criador";
  let usuario: string | null = null;
  try {
    const p = await lerPerfil();
    nome = p.nome ?? (p.usuario ? `@${p.usuario}` : nome);
    usuario = p.usuario;
  } catch {}
  const contato = usuario ? `por direct pro @${usuario}` : "por direct no Instagram";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed text-suave">
      <h1 className="titulo text-texto">Política de privacidade</h1>
      <p className="mt-1 text-xs text-apagado">
        {nome}
        {usuario ? ` (@${usuario})` : ""}
      </p>

      <h2 className="mt-8 font-medium text-texto">O que é</h2>
      <p className="mt-2">
        Este é o sistema que {nome} usa pra responder comentários e mensagens no Instagram e organizar a produção de conteúdo. Não é um serviço
        aberto ao público e não vende dados de ninguém.
      </p>

      <h2 className="mt-6 font-medium text-texto">Quais dados usamos</h2>
      <p className="mt-2">
        Quando você comenta num post ou manda mensagem no Instagram, guardamos o seu nome de usuário, o identificador que a plataforma fornece, o
        conteúdo da mensagem ou do comentário e a data. Usamos isso só pra responder você, mandar o material que você pediu e lembrar da conversa.
      </p>

      <h2 className="mt-6 font-medium text-texto">Com quem compartilhamos</h2>
      <p className="mt-2">
        Com ninguém, a não ser os serviços que fazem o sistema funcionar (hospedagem, banco de dados e o provedor de IA que ajuda a entender e
        responder as mensagens), sempre só pra essa finalidade.
      </p>

      <h2 className="mt-6 font-medium text-texto">Como pedir pra apagar seus dados</h2>
      <p className="mt-2">
        Mande “apagar meus dados” {contato}. Apagamos tudo que temos sobre você em até 7 dias e confirmamos pelo mesmo canal. Se quiser só parar de
        receber mensagens, responda “sair”.
      </p>
    </main>
  );
}
