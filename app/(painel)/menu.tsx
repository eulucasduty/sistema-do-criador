"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Ícones de traço (desenho do lucide), inline pra não puxar biblioteca
const ICONES: Record<string, React.ReactNode> = {
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5M10 21v-6h4v6" />
    </>
  ),
  esteira: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="2.5" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </>
  ),
  editor: (
    <>
      <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
      <path d="m6.2 5.3 3.1 3.9M12.4 3.4l3.1 4M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </>
  ),
  automacoes: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </>
  ),
  leads: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  agente: (
    <>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4M8 16h.01M16 16h.01" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  conexoes: <path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />,
};

const ITENS = [
  { href: "/", rotulo: "Início", icone: "inicio" },
  { href: "/esteira", rotulo: "Esteira", icone: "esteira" },
  { href: "/editor", rotulo: "Editor de vídeo", icone: "editor" },
  { href: "/instagram", rotulo: "Automações", icone: "automacoes" },
  { href: "/contatos", rotulo: "Leads", icone: "leads", contador: true },
  { href: "/agente", rotulo: "Agente de IA", icone: "agente" },
  { href: "/perfil", rotulo: "Meu perfil", icone: "perfil" },
  { href: "/conexoes", rotulo: "Conexões", icone: "conexoes" },
];

export function Menu({ alertas }: { alertas: number }) {
  const caminho = usePathname();
  return (
    <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
      {ITENS.map((item) => {
        const ativo = item.href === "/" ? caminho === "/" : caminho.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 text-sm font-bold transition ${
              ativo ? "border-tinta bg-marca text-[#05070e] shadow-[0_3px_0_#000]" : "border-transparent text-suave hover:bg-superficie-2 hover:text-texto"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                {ICONES[item.icone]}
              </svg>
              {item.rotulo}
            </span>
            {item.contador && alertas > 0 && (
              <span className="rounded-full border-2 border-tinta bg-quente px-1.5 font-mono text-[11px] font-bold leading-4 text-[#05070e]" title="Precisa de você">
                {alertas}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
