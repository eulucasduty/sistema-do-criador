// Cópia de carrossel pela estação (o seu PC): o contrato que o painel, as ações e os testes usam.
// O painel só enfileira (tabela carrossel_trabalho); a estação baixa TODOS os slides originais,
// a IA escolhida em "Quem edita" faz a arte de cada um em HTML, o kit (carrosseis/kit) confere e
// renderiza, e a versão completa volta em referencia.copia_cli. A capa conta como slide 1.

export const MAX_SLIDES_CARROSSEL = 20;
/** Até 45 MB por arquivo (o Storage grátis aceita até 50 MB). */
export const MAX_BYTES_SLIDE = 45 * 1024 * 1024;
export const STATUS_ATIVOS = ["aguardando_estacao", "criando", "renderizando", "enviando"];

export type TextoCarrossel = "traduzir" | "reformular";

export type PedidoCarrossel = {
  id: string;
  referencia_id: string;
  status: string;
  headline: string | null;
  modo_texto: TextoCarrossel;
  pedido: string | null;
  referencias: string[];
  motor: string | null;
  etapa: string | null;
  erro: string | null;
  criado_em: string;
};

export type ResultadoCarrossel = {
  titulo: string;
  legenda: string;
  idioma: "pt-BR";
  pedido_id: string;
  /** Caminhos no bucket esteira, na ordem: .png ou .mp4 (slide em vídeo; o .png do mesmo nome é a capa). */
  arquivos: string[];
  textos: Array<{ n: number; original: string; ptbr: string }>;
  gerado_em: string;
  motor: string;
  modelo: string | null;
};

/** O que a estação grava em configuracao "estacao_carrosseis" a cada 30 s. */
export type BatidaCarrossel = { visto_em?: string | null; maquina?: string | null; ocupada?: boolean; trabalho_id?: string | null };
export const estacaoCarrosselLigada = (b: BatidaCarrossel | null | undefined) => Boolean(b?.visto_em && Date.now() - Date.parse(b.visto_em) < 90_000);

/** Slide em vídeo (o storage guarda vídeo sempre como .mp4). */
export const ehVideo = (caminho: string) => /\.(mp4|mov|webm|m4v)$/i.test(caminho);
export const tipoDoArquivo = (caminho: string) =>
  ehVideo(caminho) ? "video/mp4" : caminho.endsWith(".png") ? "image/png" : caminho.endsWith(".webp") ? "image/webp" : "image/jpeg";

/** A capa e os outros slides, na ordem. Tira só o MESMO arquivo repetido, nunca slide parecido. */
export function referenciasDoCarrossel(r: { arquivo?: string | null; slides?: string[] | null }): string[] {
  return [...new Set([r.arquivo, ...(r.slides ?? [])].filter((s): s is string => Boolean(s)))];
}

/** Confere se dá pra copiar: de 2 a 20 slides e, se informado, a quantidade do original. */
export function conferirReferencias(caminhos: string[], esperado?: number): void {
  if (caminhos.length < 2) throw new Error("Só tem a capa. Suba todos os slides antes de copiar o carrossel.");
  if (caminhos.length > MAX_SLIDES_CARROSSEL) throw new Error(`Até ${MAX_SLIDES_CARROSSEL} slides, contando a capa.`);
  if (esperado !== undefined && (!Number.isInteger(esperado) || esperado < 2 || esperado > MAX_SLIDES_CARROSSEL))
    throw new Error(`Informe quantos slides o original tem (de 2 a ${MAX_SLIDES_CARROSSEL}).`);
  if (esperado !== undefined && caminhos.length !== esperado)
    throw new Error(`Tem ${caminhos.length} arquivos aqui, mas o original tem ${esperado} slides. Suba os que faltam ou confira a quantidade antes de copiar.`);
}
