import "server-only";
import { instagramConfigurado, midiasRecentes, type Midia } from "@/lib/instagram/api";

/** Os últimos posts da conta pro seletor da automação (só o que a tela usa). */
export async function midiasParaEscolher(): Promise<{ midias: Midia[]; erro: string | null }> {
  if (!(await instagramConfigurado().catch(() => false))) {
    return { midias: [], erro: "Conecte o Instagram em Conexões pra escolher os posts aqui." };
  }
  try {
    const midias = await midiasRecentes(24);
    return {
      midias: midias.map((m) => ({
        id: m.id,
        caption: m.caption?.slice(0, 80),
        media_type: m.media_type,
        thumbnail_url: m.thumbnail_url,
        media_url: m.media_type === "VIDEO" ? undefined : m.media_url,
        timestamp: m.timestamp,
      })),
      erro: null,
    };
  } catch (e) {
    return { midias: [], erro: `Não consegui listar os posts: ${(e as Error).message}` };
  }
}
