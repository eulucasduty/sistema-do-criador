// Ícone (Lucide, o mesmo catálogo do kit), logo oficial e imagem com Ken Burns.
// Logos, prints e materiais da oficina chegam no public (staticFile("logos/x.svg")).
import React from "react";
import { Img, staticFile } from "remotion";
import ICONES from "../../../kit/icones/icones.json";
import { entre, useAnim } from "./anim";
import { CURVA, useTema } from "./tema";

const LISTA = ICONES as Record<string, string>;

/** Ícone do Lucide pelo nome (kit/icones/nomes.txt). */
export const Icone: React.FC<{ nome: string; tamanho?: number; cor?: string; traco?: number; style?: React.CSSProperties }> = ({ nome, tamanho = 64, cor, traco = 2, style }) => {
  const { cores } = useTema();
  const dentro = LISTA[nome] ?? LISTA["circle"] ?? '<circle cx="12" cy="12" r="10"/>';
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor ?? cores.heroi} strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", ...style }} dangerouslySetInnerHTML={{ __html: dentro }} />;
};

/** Logo oficial que o editor baixou pra oficina (logos/...). */
export const Logo: React.FC<{ arquivo: string; tamanho?: number; caixa?: boolean; style?: React.CSSProperties }> = ({ arquivo, tamanho = 160, caixa = true, style }) => {
  const { cores } = useTema();
  const img = <Img src={staticFile(arquivo)} style={{ width: caixa ? "64%" : "100%", height: caixa ? "64%" : "100%", objectFit: "contain" }} />;
  if (!caixa) return <div style={{ width: tamanho, height: tamanho, ...style }}>{img}</div>;
  return <div style={{ width: tamanho, height: tamanho, borderRadius: tamanho * 0.24, background: cores.card, border: `2px solid ${cores.borda}`, boxShadow: `0 18px 40px ${cores.sombra}`, display: "grid", placeItems: "center", ...style }}>{img}</div>;
};

/** Imagem (print, material) que nunca fica parada: aproxima e anda devagar a cena inteira. */
export const Imagem: React.FC<{ arquivo: string; zoom?: [number, number]; anda?: [number, number]; style?: React.CSSProperties }> = ({ arquivo, zoom = [1, 1.1], anda = [0, -30], style }) => {
  const { t, dur } = useAnim();
  const z = entre(t, [0, dur], zoom, CURVA.suave);
  const x = entre(t, [0, dur], anda, CURVA.suave);
  return <Img src={staticFile(arquivo)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateX(${x}px)`, ...style }} />;
};
