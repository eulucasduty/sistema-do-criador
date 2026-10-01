import type { Metadata } from "next";
import { JetBrains_Mono, Lilita_One, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Tipografia: Lilita One (títulos e a marca), Plus Jakarta Sans (texto) e JetBrains Mono
// (números e selos)
const lilita = Lilita_One({ variable: "--font-lilita", subsets: ["latin"], weight: "400" });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Creator System",
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
