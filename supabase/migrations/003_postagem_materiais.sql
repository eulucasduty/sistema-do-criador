-- Creator System · 003 · postar no Instagram com 1 clique e os materiais dos CTAs
--
-- Cole no SQL Editor do Supabase e clique em Run (ou npm run migrar). Pode rodar de novo: não
-- estraga nada.
--
--   1. Postar: quando o vídeo fica pronto no editor, a estação (no seu PC) escreve a legenda na
--      sua voz, com o "comenta X" do CTA. Você mexe no que quiser e um botão posta como Reel pela
--      API oficial do Instagram (container → processamento → publicar); o relógio acompanha.
--   2. Materiais: o que você entrega pra quem comenta a palavra do CTA (passo a passo, prompts,
--      links, templates), numa página pública /m/<endereço> feita pro celular. A estação monta o
--      rascunho, você revisa e publica. Com "mandar na DM", quem comenta recebe o link da página.

-- ── a edição guarda a fala e a palavra do CTA (a legenda e o material partem disso) ──
alter table public.edicao add column if not exists transcricao text;
alter table public.edicao add column if not exists cta_palavra text;
comment on column public.edicao.transcricao is 'a fala do vídeo (transcrição corrida), gravada pela estação no fim da edição';
comment on column public.edicao.cta_palavra is 'a palavra do CTA ("comenta X") que o editor pôs no vídeo';

-- ── postagem: o post do vídeo editado, uma por edição ──
create table if not exists public.postagem (
  id                 uuid primary key default gen_random_uuid(),
  edicao_id          uuid not null unique references public.edicao (id) on delete cascade,
  status             text not null default 'aguardando_estacao'
                     check (status in ('aguardando_estacao', 'escrevendo', 'pronta', 'enviando', 'processando', 'publicando', 'publicada', 'erro')),
  legenda            text,
  palavra            text,                -- a palavra do CTA (liga com a automação e o material)
  compartilhar_feed  boolean not null default true,
  capa_s             numeric,             -- o segundo do vídeo usado de capa; vazio = o Instagram escolhe
  container_id       text,                -- o container do Reel na Meta (enquanto processa)
  media_id           text,                -- o post publicado
  permalink          text,
  etapa              text,
  erro               text,
  estacao            text,                -- o PC que escreveu a legenda
  processando_desde  timestamptz,
  enviado_em         timestamptz,
  publicado_em       timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
comment on table public.postagem is 'o post do vídeo editado no Instagram: a legenda (escrita pela estação, editável) e o andamento do envio pela API';
create index if not exists postagem_fila_idx on public.postagem (criado_em) where status = 'aguardando_estacao';
create index if not exists postagem_andando_idx on public.postagem (enviado_em) where status in ('enviando', 'processando', 'publicando');

-- ── entrega: o material de um CTA, numa página pública /m/<slug> ──
create table if not exists public.entrega (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  palavra            text,                -- quem comenta esta palavra recebe o link (se na_dm e publicada)
  titulo             text not null default '',
  subtitulo          text,
  blocos             jsonb not null default '[]'::jsonb,  -- [{tipo: texto|passos|prompt|link|template|aviso, …}]
  pedido             text,                -- o que você pediu pra entregar (prompts e links colados)
  ajuste             text,                -- o ajuste pedido pra IA (a estação limpa quando faz)
  edicao_id          uuid references public.edicao (id) on delete set null,
  status             text not null default 'rascunho'
                     check (status in ('rascunho', 'aguardando_estacao', 'escrevendo', 'pronta', 'erro')),
  publicada          boolean not null default false,
  na_dm              boolean not null default true,
  visitas            integer not null default 0,
  etapa              text,
  erro               text,
  estacao            text,
  processando_desde  timestamptz,
  publicada_em       timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
comment on table public.entrega is 'o material de um CTA (passo a passo, prompts, links, templates), na página pública /m/<slug>';
create index if not exists entrega_fila_idx on public.entrega (criado_em) where status = 'aguardando_estacao';
create index if not exists entrega_palavra_idx on public.entrega (palavra) where publicada;

-- ── segurança: a mesma regra das outras tabelas (só a equipe; a página pública lê pelo servidor) ──
do $$
declare
  t text;
begin
  foreach t in array array['postagem', 'entrega'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to authenticated, service_role', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists equipe_tudo on public.%I', t);
    execute format(
      'create policy equipe_tudo on public.%I for all to authenticated '
      'using ((select criador_privado.eh_da_equipe())) '
      'with check ((select criador_privado.eh_da_equipe()))', t);
    execute format('drop trigger if exists tocar_atualizado_em on public.%I', t);
    execute format('create trigger tocar_atualizado_em before update on public.%I '
                   'for each row execute function public.tocar_atualizado_em()', t);
  end loop;
end
$$;

-- A página pública (sem login) soma a visita pelo servidor (chave secreta); ninguém de fora chama
create or replace function public.contar_visita_entrega(p_slug text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.entrega set visitas = visitas + 1 where slug = p_slug and publicada;
$$;
revoke all on function public.contar_visita_entrega(text) from public, anon, authenticated;
grant execute on function public.contar_visita_entrega(text) to service_role;

-- O convite que vai depois do material (na DM e no fim da página) e o texto da DM
insert into public.configuracao (chave, valor, descricao) values
  ('entregas', '{"dm_texto": "tá aqui o material 👇", "dm_botao": "abrir o material", "convite_texto": "", "convite_botao": "quero entrar", "convite_link": ""}',
   'Materiais: a mensagem da DM com o link e o convite que vai depois (grupo, lista, produto)')
on conflict (chave) do nothing;
