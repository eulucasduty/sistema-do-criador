"use client";

// Troca escuro ↔ claro. O tema fica no <html data-tema>, lembrado no navegador; o script
// no <head> (app/layout.tsx) aplica antes de pintar, sem piscar. Ícone e texto trocam
// por CSS (.so-claro / .so-escuro), então o servidor não precisa saber o tema.
export function BotaoTema({ className = "" }: { className?: string }) {
  function alternar() {
    const html = document.documentElement;
    const novo = html.dataset.tema === "claro" ? "escuro" : "claro";
    html.dataset.tema = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {}
  }
  return (
    <button type="button" onClick={alternar} className={`inline-flex items-center gap-1.5 ${className}`} title="Trocar o tema">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="so-escuro h-3.5 w-3.5">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="so-claro h-3.5 w-3.5">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
      <span className="so-escuro">Modo claro</span>
      <span className="so-claro">Modo escuro</span>
    </button>
  );
}
