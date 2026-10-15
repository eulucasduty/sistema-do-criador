"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { conferirPostagem } from "./postagem-acoes";

/**
 * Enquanto o Instagram processa o vídeo, a página dá um passo a cada poucos segundos (confere o
 * container e publica quando ficar pronto) e recarrega. Fechou a página? O relógio termina.
 */
export function AcompanharPostagem({ id, segundos = 8 }: { id: string; segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    let parar = false;
    const t = setInterval(async () => {
      try {
        await conferirPostagem(id);
      } catch {}
      if (!parar) router.refresh();
    }, segundos * 1000);
    return () => {
      parar = true;
      clearInterval(t);
    };
  }, [id, router, segundos]);
  return null;
}
