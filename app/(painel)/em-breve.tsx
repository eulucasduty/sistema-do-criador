export function EmBreve({ titulo, fase, itens }: { titulo: string; fase: string; itens: string[] }) {
  return (
    <div className="max-w-2xl">
      <h1 className="titulo">{titulo}</h1>
      <p className="mt-1 text-sm text-suave">
        <span className="rounded-md bg-marca-fundo px-2 py-0.5 text-xs font-medium text-marca">{fase}</span> Em construção.
      </p>
      <ul className="mt-6 space-y-2">
        {itens.map((item) => (
          <li key={item} className="card flex gap-3 px-4 py-3 text-sm text-suave">
            <span className="text-marca">→</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
