import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Tipografia: Lilita One (títulos e a marca), Plus Jakarta Sans (texto) e JetBrains Mono
// (números e selos)
const lilita = localFont({ variable: "--font-lilita", src: "../public/fontes/lilita-one-latin-400-normal.woff", weight: "400", display: "swap" });
const jakarta = localFont({ variable: "--font-jakarta", src: [
  { path: "../public/fontes/plus-jakarta-sans-latin-500-normal.woff", weight: "500" },
  { path: "../public/fontes/plus-jakarta-sans-latin-700-normal.woff", weight: "700" },
  { path: "../public/fontes/plus-jakarta-sans-latin-800-normal.woff", weight: "800" },
], display: "swap" });
const jetbrains = localFont({ variable: "--font-jetbrains", src: "../public/fontes/jetbrains-mono-latin-500-normal.woff", weight: "500", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Creaty · Seu estúdio de conteúdo", template: "%s · Creaty" },
  description: "Esteira de referências, roteiro na sua voz, editor de vídeo com IA e automações do Instagram",
  robots: { index: false, follow: false },
};

// Aplica o tema salvo antes de pintar (sem piscar o escuro pra quem usa o claro)
const TEMA = `try{var t=localStorage.getItem("tema");if(t==="claro"||t==="escuro")document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${lilita.variable} ${jakarta.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
