/** Contrato do carrossel: a capa conta como slide 1; nenhuma referência é descartada. */
export const MAX_SLIDES_CARROSSEL = 20;
export const STATUS_ATIVOS = ["aguardando_estacao", "criando", "renderizando", "enviando"];
export type AgenteCarrossel = "codex" | "claude";
export type TextoCarrossel = "traduzir" | "reformular";
/** copiar = reaproveita fotos e prints do original; recriar = mesma identidade, imagens novas (padrão desde 17/10). */
export type VisualCarrossel = "copiar" | "recriar";
export type PedidoCarrossel = {
  id: string;
  referencia_id: string;
  status: string;
  agente: AgenteCarrossel;
  headline: string | null;
  modo_texto: TextoCarrossel;
  modo_visual?: VisualCarrossel;
  pedido: string | null;
  referencias: string[];
  etapa: string | null;
  erro: string | null;
  criado_em: string;
};
export type ResultadoCarrossel = {
  titulo: string;
  legenda: string;
  idioma: "pt-BR";
  agente: AgenteCarrossel;
  pedido_id: string;
  arquivos: string[];
  textos: Array<{ n: number; original: string; ptbr: string }>;
  gerado_em: string;
  modelo: string;
};
export type BatidaCarrossel = { visto_em?: string | null; maquina?: string; agente?: string; ocupada?: boolean };
export function estacaoCarrosselLigada(b: BatidaCarrossel | null | undefined): boolean {
  return Boolean(b?.visto_em && Date.now() - Date.parse(b.visto_em) < 90_000);
}
/** Slide em vídeo (o storage guarda vídeo sempre como .mp4). */
export const ehVideo = (caminho: string) => /\.(mp4|mov|webm|m4v)$/i.test(caminho);
export const tipoDoArquivo = (caminho: string) => (ehVideo(caminho) ? "video/mp4" : caminho.endsWith(".png") ? "image/png" : caminho.endsWith(".webp") ? "image/webp" : "image/jpeg");
export function referenciasDoCarrossel(r: { arquivo?: string | null; slides?: string[] | null }): string[] {
  // Remove apenas o MESMO arquivo repetido, nunca slides com conteúdo parecido.
  return [...new Set([r.arquivo, ...(r.slides ?? [])].filter((s): s is string => Boolean(s)))];
}
export function conferirReferencias(caminhos: string[], esperado?: number): void {
  if (caminhos.length < 2) throw new Error("Só existe a capa. Envie todos os slides antes de copiar o carrossel.");
  if (caminhos.length > MAX_SLIDES_CARROSSEL) throw new Error(`Envie até ${MAX_SLIDES_CARROSSEL} slides, incluindo a capa.`);
  if (esperado !== undefined && (!Number.isInteger(esperado) || esperado < 2 || esperado > MAX_SLIDES_CARROSSEL)) throw new Error("Informe a quantidade total de slides do original (de 2 a 20).");
  if (esperado !== undefined && caminhos.length !== esperado) throw new Error(`Há ${caminhos.length} imagens salvas, mas o original tem ${esperado} slides. Complete os arquivos ou confira a quantidade antes de copiar.`);
}
