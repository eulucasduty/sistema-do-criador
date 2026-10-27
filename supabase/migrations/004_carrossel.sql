-- Creator System · 004 · cópia de carrossel pela estação (o seu PC)
--
-- O painel só põe o pedido na fila (carrossel_trabalho). A estação, logada com o SEU login (RLS,
-- sem chave secreta), pega o pedido, baixa todos os slides originais do bucket "esteira", a IA de
-- "Quem edita" faz a arte, e os PNG/MP4 sobem em esteira/carrosseis/<pedido>/. No fim,
-- concluir_carrossel() publica a versão completa em referencia.copia_cli.
-- Pode rodar de novo sem problema (tudo "se não existir" / "ou substitui").

-- A versão completa da cópia: { titulo, legenda, arquivos[], textos[], gerado_em, motor, … }
alter table public.referencia add column if not exists copia_cli jsonb;

create table if not exists public.carrossel_trabalho (
  id                 uuid primary key default gen_random_uuid(),
  referencia_id      uuid not null references public.referencia (id) on delete cascade,
  status             text not null default 'aguardando_estacao'
                       check (status in ('aguardando_estacao', 'criando', 'renderizando', 'enviando', 'pronto', 'erro')),
  headline           text,                -- a headline nova da capa (vazio: traduz a original)
  modo_texto         text not null default 'traduzir' check (modo_texto in ('traduzir', 'reformular')),
  pedido             text,                -- direção opcional do criador
  referencias        text[] not null check (cardinality(referencias) between 2 and 20),  -- os slides, na ordem, fixos pro pedido
  motor              text check (motor in ('claude', 'codex', 'openrouter')),            -- quem fez (a estação preenche)
  resultado          jsonb,
  etapa              text,
  erro               text,
  estacao            text,                -- o PC que pegou o pedido
  processando_desde  timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index if not exists carrossel_fila_idx on public.carrossel_trabalho (criado_em) where status = 'aguardando_estacao';
create index if not exists carrossel_referencia_idx on public.carrossel_trabalho (referencia_id, criado_em desc);
-- Um pedido ativo por referência
create unique index if not exists carrossel_um_ativo_idx on public.carrossel_trabalho (referencia_id)
  where status in ('aguardando_estacao', 'criando', 'renderizando', 'enviando');

alter table public.carrossel_trabalho enable row level security;
grant all on public.carrossel_trabalho to authenticated, service_role;
revoke all on public.carrossel_trabalho from anon;
drop policy if exists equipe_tudo on public.carrossel_trabalho;
create policy equipe_tudo on public.carrossel_trabalho for all to authenticated
  using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));
drop trigger if exists tocar_atualizado_em on public.carrossel_trabalho;
create trigger tocar_atualizado_em before update on public.carrossel_trabalho
  for each row execute function public.tocar_atualizado_em();

-- Slides novos no fim de um carrossel, sem perder nenhum quando dois envios chegam juntos
-- (trava a linha). Sem capa, o 1º vira a capa. Até 20 no total, contando a capa.
create or replace function public.anexar_slides_carrossel(p_referencia uuid, p_caminhos text[], p_tipo_capa text default null)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  atual public.referencia%rowtype;
  todos text[];
begin
  if coalesce(cardinality(p_caminhos), 0) = 0 then
    raise exception 'nenhum slide pra juntar';
  end if;
  select * into atual from public.referencia where id = p_referencia for update;
  if not found then
    raise exception 'referência não encontrada';
  end if;
  -- A ordem de chegada, sem o MESMO arquivo duas vezes
  todos := array(select c from (select c, min(o) as o from unnest(array_remove(array[atual.arquivo], null) || coalesce(atual.slides, '{}') || p_caminhos) with ordinality as x(c, o) group by c) y order by o);
  if cardinality(todos) > 20 then
    raise exception 'o carrossel tem até 20 slides, contando a capa';
  end if;
  update public.referencia set
    arquivo = todos[1],
    arquivo_tipo = case when atual.arquivo is null then coalesce(p_tipo_capa, arquivo_tipo) else arquivo_tipo end,
    slides = todos[2:],
    tipo = case when tipo in ('reel', 'post', 'outro') then 'carrossel' else tipo end,
    aguardando_video = false, sem_video_motivo = null,
    analise = null, assistido = null, tentativas = 0, erro = null
  where id = p_referencia;
  return todos;
end
$$;
revoke all on function public.anexar_slides_carrossel(uuid, text[], text) from public, anon;
grant execute on function public.anexar_slides_carrossel(uuid, text[], text) to authenticated, service_role;

-- A estação terminou: publica a cópia na referência e fecha o pedido, juntos.
create or replace function public.concluir_carrossel(p_trabalho uuid, p_resultado jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t public.carrossel_trabalho%rowtype;
begin
  select * into t from public.carrossel_trabalho where id = p_trabalho for update;
  if not found then
    raise exception 'pedido de carrossel não encontrado';
  end if;
  if t.status not in ('criando', 'renderizando', 'enviando') then
    raise exception 'esse pedido não está em produção (status %)', t.status;
  end if;
  if jsonb_typeof(p_resultado -> 'arquivos') is distinct from 'array' or jsonb_array_length(p_resultado -> 'arquivos') <> cardinality(t.referencias) then
    raise exception 'a cópia precisa ter os % slides do original', cardinality(t.referencias);
  end if;
  update public.carrossel_trabalho set
    status = 'pronto', resultado = p_resultado, etapa = null, erro = null, processando_desde = null
  where id = p_trabalho;
  update public.referencia set copia_cli = p_resultado where id = t.referencia_id;
  if not found then
    raise exception 'a referência desse pedido não existe mais';
  end if;
end
$$;
revoke all on function public.concluir_carrossel(uuid, jsonb) from public, anon;
grant execute on function public.concluir_carrossel(uuid, jsonb) to authenticated, service_role;

-- ── Storage: a estação (logada como você) lê os slides originais do bucket "esteira" e sobe a
-- cópia só em esteira/carrosseis/… (o resto do bucket continua só pelo servidor)
drop policy if exists criador_esteira_ler on storage.objects;
create policy criador_esteira_ler on storage.objects for select to authenticated
  using (bucket_id = 'esteira' and (select criador_privado.eh_da_equipe()));
drop policy if exists criador_esteira_carrosseis on storage.objects;
create policy criador_esteira_carrosseis on storage.objects for all to authenticated
  using (bucket_id = 'esteira' and name like 'carrosseis/%' and (select criador_privado.eh_da_equipe()))
  with check (bucket_id = 'esteira' and name like 'carrosseis/%' and (select criador_privado.eh_da_equipe()));

-- A batida da parte dos carrosséis da estação (o painel mostra se ela está ligada)
insert into public.configuracao (chave, valor, descricao) values
  ('estacao_carrosseis', '{"visto_em": null, "maquina": null, "ocupada": false}', 'Batida da cópia de carrosséis na estação (o seu PC)')
on conflict (chave) do nothing;
