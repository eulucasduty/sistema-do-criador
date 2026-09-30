// O Supabase devolve no máximo 1.000 linhas por consulta (max_rows da Data API),
// mesmo com .limit() maior. Pra ler tudo, pagina de 1.000 em 1.000 com .range().
//
//   const linhas = await todas((de, ate) => db.from("card").select("contato_id").eq(...).range(de, ate));

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function todas<T>(consulta: (de: number, ate: number) => Pagina<T>, maximo = 50_000): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; de < maximo; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error(error.message);
    saida.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return saida;
}
