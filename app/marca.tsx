// A marca do sistema: o selo (um play com faísca) e o nome com prefixo em minúscula +
// nome em caixa alta, com o corte estêncil atravessando as letras.
export function Marca({ tamanho = "md" }: { tamanho?: "md" | "lg" }) {
  const grande = tamanho === "lg";
  return (
    <span className={`flex items-center ${grande ? "flex-col gap-4" : "gap-3"}`}>
      <span
        className={`flex shrink-0 items-center justify-center border-tinta bg-marca text-[#05070e] ${
          grande ? "h-[88px] w-[88px] rounded-[26px] border-[3px] shadow-[0_6px_0_#000]" : "h-11 w-11 rounded-[14px] border-2 shadow-[0_3px_0_#000]"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className={grande ? "h-11 w-11" : "h-6 w-6"} aria-hidden>
          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
          <path d="M3.5 3.2l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6zM4 15.5l.45 1.2 1.2.45-1.2.45L4 18.8l-.45-1.2-1.2-.45 1.2-.45z" />
        </svg>
      </span>
      <span className={`logo ${grande ? "text-[40px]" : "text-[22px]"}`} aria-label="Sistema do Criador">
        <span className="logo-eu" style={{ "--c": "var(--color-marca)" } as React.CSSProperties}>sistema</span>
        <span style={{ "--c": "var(--color-texto)" } as React.CSSProperties}>CRIADOR</span>
      </span>
    </span>
  );
}
