-- Creaty: produção de conteúdo. Aplicar depois da 001_sistema.sql.


create table if not exists public.roteiro (
  id                uuid primary key default gen_random_uuid(),
  titulo            text,
  origem            text not null check (origem in ('tema', 'arquivo', 'link', 'esteira')),
  tema              text,
  direcao           text,
  palavra_cta       text,
  duracao_alvo      integer not null default 45 check (duracao_alvo between 15 and 180),
  link              text,
  referencia_id     uuid references public.referencia(id) on delete set null,
  arquivo           text,
  arquivo_tipo      text,
  arquivo_nome      text,
  status            text not null default 'na_fila'
                    check (status in ('subindo', 'na_fila', 'transcrevendo', 'escrevendo', 'pronto', 'erro')),
  etapa             text,
  transcricao       jsonb,
  analise           jsonb,
  versoes           jsonb not null default '[]'::jsonb,
  erro              text,
  processando_desde timestamptz,
  custo_usd         numeric(10, 4) not null default 0,
  criado_por        uuid,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
comment on column public.roteiro.arquivo is 'vídeo ou áudio da referência no bucket esteira (roteiro/<id>/…), apagado depois de transcrito';
comment on column public.roteiro.transcricao is '{duracao_seg, fala: [{t, texto}], cenas, audio, fonte}: o que a IA ouviu na referência';
comment on column public.roteiro.analise is 'assunto, ângulo, gancho e estrutura da referência, em abstrato (sem as falas)';
comment on column public.roteiro.versoes is 'os roteiros gerados, o mais novo primeiro (até 5): gancho, corpo, cta, checagem anti-IA';
create index if not exists roteiro_criado_idx on public.roteiro (criado_em desc);
alter table public.roteiro enable row level security;
drop policy if exists equipe_tudo on public.roteiro;
create policy equipe_tudo on public.roteiro
  for all to authenticated using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));
drop trigger if exists tocar_atualizado_em on public.roteiro;
create trigger tocar_atualizado_em before update on public.roteiro
  for each row execute function public.tocar_atualizado_em();


alter table public.roteiro drop constraint if exists roteiro_status_check;
alter table public.roteiro add constraint roteiro_status_check
  check (status in ('subindo', 'na_fila', 'transcrevendo', 'aguardando_estacao', 'escrevendo', 'pronto', 'erro'));

alter table public.roteiro add column if not exists via text not null default 'estacao' check (via in ('estacao', 'api'));
alter table public.roteiro add column if not exists estacao text;
comment on column public.roteiro.via is 'quem escreve: a estação no PC do criador (plano do Claude) ou a API (só pelo botão, manual)';
comment on column public.roteiro.estacao is 'a máquina que pegou o pedido';

create index if not exists roteiro_fila_estacao_idx on public.roteiro (criado_em) where status = 'aguardando_estacao';


alter table public.edicao add column if not exists transcricao text;
alter table public.edicao add column if not exists cta_palavra text;
comment on column public.edicao.transcricao is 'a fala do vídeo (transcrição corrida), gravada pela estação no fim da edição';
comment on column public.edicao.cta_palavra is 'a palavra do CTA ("comenta X") que o editor pôs no vídeo';

create table if not exists public.postagem (
  id                 uuid primary key default gen_random_uuid(),
  edicao_id          uuid not null unique references public.edicao(id) on delete cascade,
  status             text not null default 'aguardando_estacao'
                     check (status in ('aguardando_estacao', 'escrevendo', 'pronta', 'enviando', 'processando', 'publicando', 'publicada', 'erro')),
  legenda            text,
  palavra            text,
  compartilhar_feed  boolean not null default true,
  capa_s             numeric,
  container_id       text,
  media_id           text,
  permalink          text,
  etapa              text,
  erro               text,
  estacao            text,
  processando_desde  timestamptz,
  enviado_em         timestamptz,
  publicado_em       timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
comment on table public.postagem is 'o post do vídeo editado no Instagram: legenda (escrita pela estação, editável) e o andamento do envio pela API';
comment on column public.postagem.capa_s is 'o segundo do vídeo usado como capa (thumb_offset); vazio = o que o Instagram escolher';
create index if not exists postagem_fila_estacao_idx on public.postagem (criado_em) where status = 'aguardando_estacao';
create index if not exists postagem_processando_idx on public.postagem (enviado_em) where status in ('processando', 'publicando');
alter table public.postagem enable row level security;
drop policy if exists equipe_tudo on public.postagem;
drop policy if exists equipe_tudo on public.postagem;
create policy equipe_tudo on public.postagem
  for all to authenticated using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));
drop trigger if exists tocar_atualizado_em on public.postagem;
drop trigger if exists tocar_atualizado_em on public.postagem;
create trigger tocar_atualizado_em before update on public.postagem
  for each row execute function public.tocar_atualizado_em();

create table if not exists public.entrega (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  palavra            text,
  titulo             text not null default '',
  subtitulo          text,
  blocos             jsonb not null default '[]'::jsonb,
  pedido             text,
  ajuste             text,
  edicao_id          uuid references public.edicao(id) on delete set null,
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
comment on column public.entrega.palavra is 'a palavra do comentário: quem comenta recebe o link desta entrega na DM (se na_dm e publicada)';
comment on column public.entrega.blocos is '[{tipo: texto|passos|prompt|link|template|aviso, …}] (lib/entregas/blocos.ts)';
comment on column public.entrega.pedido is 'o que o criador escreveu: o que entregar, prompts e links colados';
create index if not exists entrega_fila_estacao_idx on public.entrega (criado_em) where status = 'aguardando_estacao';
create index if not exists entrega_palavra_idx on public.entrega (palavra) where publicada;
alter table public.entrega enable row level security;
drop policy if exists equipe_tudo on public.entrega;
drop policy if exists equipe_tudo on public.entrega;
create policy equipe_tudo on public.entrega
  for all to authenticated using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));
drop trigger if exists tocar_atualizado_em on public.entrega;
drop trigger if exists tocar_atualizado_em on public.entrega;
create trigger tocar_atualizado_em before update on public.entrega
  for each row execute function public.tocar_atualizado_em();

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

alter table public.referencia add column if not exists copia_cli jsonb;
create table if not exists public.carrossel_trabalho (
  id uuid primary key default gen_random_uuid(),
  referencia_id uuid not null references public.referencia(id) on delete cascade,
  status text not null default 'aguardando_estacao'
    check (status in ('aguardando_estacao','criando','renderizando','enviando','pronto','erro')),
  agente text not null default 'codex' check (agente in ('codex','claude')),
  headline text,
  modo_texto text not null default 'traduzir' check (modo_texto in ('traduzir','reformular')),
  pedido text,
  referencias text[] not null check (cardinality(referencias) between 2 and 20),
  resultado jsonb,
  etapa text,
  erro text,
  estacao text,
  processando_desde timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists carrossel_fila_idx on public.carrossel_trabalho(criado_em) where status = 'aguardando_estacao';
create index if not exists carrossel_referencia_idx on public.carrossel_trabalho(referencia_id, criado_em desc);
create unique index if not exists carrossel_um_ativo_idx on public.carrossel_trabalho(referencia_id)
  where status in ('aguardando_estacao','criando','renderizando','enviando');
alter table public.carrossel_trabalho enable row level security;
drop policy if exists equipe_tudo on public.carrossel_trabalho;
create policy equipe_tudo on public.carrossel_trabalho for all to authenticated
  using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));
drop trigger if exists tocar_atualizado_em on public.carrossel_trabalho;
create trigger tocar_atualizado_em before update on public.carrossel_trabalho
  for each row execute function public.tocar_atualizado_em();

alter table public.referencia add column if not exists slides_mids text[] not null default '{}';
create or replace function public.anexar_slide_carrossel(ref_id uuid, caminho text, mid text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.referencia set
    arquivo = coalesce(arquivo, caminho),
    arquivo_tipo = case when arquivo is null then 'image/jpeg' else arquivo_tipo end,
    slides = case when arquivo is null then coalesce(slides, '{}') else array_append(coalesce(slides, '{}'), caminho) end,
    tipo = 'carrossel',
    slides_mids = array_append(slides_mids, mid),
    analise = null, tentativas = 0, erro = null
  where id = ref_id and not (mid = any(slides_mids))
    and cardinality(coalesce(slides, '{}')) < 19;
  return found;
end;
$$;
revoke all on function public.anexar_slide_carrossel(uuid,text,text) from public, anon, authenticated;
grant execute on function public.anexar_slide_carrossel(uuid,text,text) to service_role;

create or replace function public.anexar_slides_carrossel(ref_id uuid, caminhos text[])
returns void language plpgsql security invoker set search_path = '' as $$
declare atual public.referencia%rowtype;
begin
  select * into atual from public.referencia where id = ref_id for update;
  if not found or atual.tipo = 'reel' then raise exception 'Referência inválida'; end if;
  if cardinality(coalesce(atual.slides, '{}')) + cardinality(caminhos) + (case when atual.arquivo is null then 0 else 1 end) > 20
    then raise exception 'O total deve ser de até 20 slides, incluindo a capa'; end if;
  update public.referencia set
    arquivo = coalesce(arquivo, caminhos[1]),
    arquivo_tipo = case when arquivo is null then 'image/jpeg' else arquivo_tipo end,
    slides = coalesce(slides, '{}') || case when arquivo is null then caminhos[2:] else caminhos end,
    tipo = 'carrossel', analise = null, tentativas = 0, erro = null
  where id = ref_id;
end;
$$;
revoke all on function public.anexar_slides_carrossel(uuid,text[]) from public, anon, authenticated;
grant execute on function public.anexar_slides_carrossel(uuid,text[]) to service_role;

alter table public.carrossel_trabalho add column if not exists modo_visual text not null default 'recriar'
  check (modo_visual in ('copiar','recriar'));

comment on column public.carrossel_trabalho.modo_visual is 'copiar = reaproveita fotos e prints do original; recriar = mesma identidade, imagens novas geradas pelo ChatGPT';

alter table public.referencia add column if not exists numero integer;
alter table public.referencia add column if not exists palavra_cta text;
create unique index if not exists referencia_numero_idx on public.referencia (numero) where numero is not null;
comment on column public.referencia.numero is 'número fixo do carrossel na produção (#01, #02…), dado quando entra na fila pela primeira vez';
comment on column public.referencia.palavra_cta is 'a palavra do CTA da nossa versão (casa com entrega.palavra)';


create table if not exists public.carrossel_post (
  id                 uuid primary key default gen_random_uuid(),
  referencia_id      uuid not null references public.referencia(id) on delete cascade,
  trabalho_id        uuid references public.carrossel_trabalho(id) on delete set null,
  palavra            text,
  legenda            text not null,
  imagens            text[] not null check (cardinality(imagens) between 2 and 20),
  publicar_em        timestamptz not null,
  status             text not null default 'agendado'
                     check (status in ('agendado', 'enviando', 'processando', 'publicando', 'publicada', 'erro', 'pausado')),
  filhos             text[],
  container_id       text,
  media_id           text,
  permalink          text,
  etapa              text,
  erro               text,
  enviado_em         timestamptz,
  publicado_em       timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
comment on table public.carrossel_post is 'agenda de posts dos carrosséis: o relógio publica na hora marcada pela API do Instagram';
comment on column public.carrossel_post.imagens is 'caminhos no bucket esteira dos slides em JPG (a API do Instagram só aceita JPG), na ordem';
comment on column public.carrossel_post.filhos is 'os containers dos slides; o do carrossel só é criado quando todos estão FINISHED (slide em vídeo leva um tempo)';
comment on column public.carrossel_post.status is 'agendado → enviando → processando → publicando → publicada; pausado = fora da fila até reagendar';
create index if not exists carrossel_post_vez_idx on public.carrossel_post (publicar_em) where status = 'agendado';
create index if not exists carrossel_post_processando_idx on public.carrossel_post (enviado_em) where status in ('processando', 'publicando');
create unique index if not exists carrossel_post_um_ativo_idx on public.carrossel_post (referencia_id)
  where status in ('agendado', 'enviando', 'processando', 'publicando', 'publicada');
alter table public.carrossel_post enable row level security;
drop policy if exists equipe_tudo on public.carrossel_post;
drop policy if exists equipe_tudo on public.carrossel_post;
create policy equipe_tudo on public.carrossel_post for all to authenticated
  using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));
drop trigger if exists tocar_atualizado_em on public.carrossel_post;
drop trigger if exists tocar_atualizado_em on public.carrossel_post;
create trigger tocar_atualizado_em before update on public.carrossel_post
  for each row execute function public.tocar_atualizado_em();


create table if not exists public.criador (
  id               uuid primary key default gen_random_uuid(),
  rede             text not null check (rede in ('instagram', 'youtube')),
  usuario          text not null,
  nome             text,
  canal_id         text,
  foto             text,
  seguidores       integer,
  ativo            boolean not null default true,
  so_shorts        boolean not null default true,
  por_dia          integer not null default 3 check (por_dia between 1 and 20),
  duracao_alvo     integer not null default 45 check (duracao_alvo between 15 and 180),
  direcao          text,
  notas            text,
  visto_ate        timestamptz,
  checado_em       timestamptz,
  erro             text,
  total_roteiros   integer not null default 0,
  criado_por       uuid,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on column public.criador.usuario is 'o @ no Instagram ou o @handle / id do canal no YouTube, sem @';
comment on column public.criador.canal_id is 'YouTube: o id UC… do canal (o feed RSS é por ele)';
comment on column public.criador.so_shorts is 'YouTube: só os Shorts viram roteiro (vídeo longo não cabe em 45 s)';
comment on column public.criador.por_dia is 'no máximo quantos posts desse criador viram roteiro por dia';
comment on column public.criador.visto_ate is 'data do post mais novo já visto: o que veio antes disso é ignorado';
comment on column public.criador.direcao is 'orientação fixa pro roteirista nos roteiros desse criador';
create unique index if not exists criador_rede_usuario_idx on public.criador (rede, lower(usuario));
create index if not exists criador_checagem_idx on public.criador (checado_em nulls first) where ativo;
alter table public.criador enable row level security;
drop policy if exists equipe_tudo on public.criador;
create policy equipe_tudo on public.criador
  for all to authenticated using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));
drop trigger if exists tocar_atualizado_em on public.criador;
create trigger tocar_atualizado_em before update on public.criador
  for each row execute function public.tocar_atualizado_em();

alter table public.roteiro drop constraint if exists roteiro_origem_check;
alter table public.roteiro add constraint roteiro_origem_check
  check (origem in ('tema', 'arquivo', 'link', 'esteira', 'monitor'));

alter table public.roteiro add column if not exists criador_id uuid references public.criador(id) on delete set null;
alter table public.roteiro add column if not exists post_id text;
alter table public.roteiro add column if not exists post_publicado_em timestamptz;
alter table public.roteiro add column if not exists post_dados jsonb;
alter table public.roteiro add column if not exists automatico boolean not null default false;
comment on column public.roteiro.post_id is 'id do post no Instagram ou do vídeo no YouTube (não repete o mesmo post)';
comment on column public.roteiro.post_dados is '{legenda, curtidas, comentarios, views, link} do post quando entrou na fila';
comment on column public.roteiro.automatico is 'veio do monitor de criadores: na estação, o pedido manual passa na frente';

create unique index if not exists roteiro_post_idx on public.roteiro (criador_id, post_id) where post_id is not null;
create index if not exists roteiro_criador_idx on public.roteiro (criador_id, criado_em desc) where criador_id is not null;

drop index if exists public.roteiro_fila_estacao_idx;
create index if not exists roteiro_fila_estacao_idx on public.roteiro (automatico, criado_em) where status = 'aguardando_estacao';
create index if not exists roteiro_fila_servidor_idx on public.roteiro (criado_em) where status = 'na_fila' and automatico;


alter table public.edicao add column if not exists roteiro_id uuid references public.roteiro(id) on delete set null;
alter table public.edicao add column if not exists aprovada_em timestamptz;
comment on column public.edicao.roteiro_id is 'o roteiro gravado no gravador da esteira de reels (os ajustes herdam)';
comment on column public.edicao.aprovada_em is 'o criador conferiu e aprovou: vai pra agenda de postagem';
alter table public.edicao drop constraint if exists edicao_status_check;
alter table public.edicao add constraint edicao_status_check
  check (status in ('subindo', 'gravado', 'na_fila', 'preparando', 'editando', 'renderizando', 'enviando', 'pronto', 'erro', 'cancelada'));
comment on column public.edicao.video is '{partes, nome, tamanho, tipo} ou, do gravador, {takes: [{partes, nome, tamanho, tipo, inicio, fim, velocidade}]}';
create index if not exists edicao_roteiro_idx on public.edicao (roteiro_id, criado_em desc) where roteiro_id is not null;

alter table public.roteiro add column if not exists arquivado_em timestamptz;
comment on column public.roteiro.arquivado_em is 'tirado da esteira de reels (não vai ser gravado); continua em /roteiros';

alter table public.postagem add column if not exists publicar_em timestamptz;
comment on column public.postagem.publicar_em is 'quando o relógio posta sozinho (vazio = só pelo botão "Postar agora")';
create index if not exists postagem_agenda_idx on public.postagem (publicar_em) where publicar_em is not null and status = 'pronta';

create table if not exists public.musica (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  arquivo     text not null,
  tipo        text,
  tamanho     integer,
  duracao_s   numeric,
  criado_por  uuid,
  criado_em   timestamptz not null default now()
);
comment on table public.musica is 'músicas de fundo do gravador (bucket edicao, musicas/<id>.<ext>)';
alter table public.musica enable row level security;
drop policy if exists equipe_tudo on public.musica;
drop policy if exists equipe_tudo on public.musica;
create policy equipe_tudo on public.musica
  for all to authenticated using ((select criador_privado.eh_da_equipe())) with check ((select criador_privado.eh_da_equipe()));

alter table public.referencia drop constraint if exists referencia_origem_check;
alter table public.referencia add constraint referencia_origem_check check (origem in ('dm', 'manual', 'monitor'));
alter table public.referencia add column if not exists criador_id uuid references public.criador(id) on delete set null;
alter table public.referencia add column if not exists post_id text;
create unique index if not exists referencia_post_idx on public.referencia (criador_id, post_id) where post_id is not null;
alter table public.criador add column if not exists total_carrosseis integer not null default 0;


alter table public.roteiro drop constraint if exists roteiro_origem_check;
alter table public.roteiro add constraint roteiro_origem_check
  check (origem in ('tema', 'arquivo', 'link', 'esteira', 'monitor', 'manual'));

alter table public.ig_automacao add column if not exists carrossel_post_id uuid references public.carrossel_post(id) on delete set null;

alter table public.referencia drop constraint if exists referencia_origem_check;
alter table public.referencia add constraint referencia_origem_check check (origem in ('link', 'upload', 'manual', 'monitor'));
alter table public.referencia add column if not exists enviado_por text;
update public.agente set ativo = false;
update public.conversa set responder_apos = null;
update public.ig_automacao set modo = 'botao' where modo <> 'botao';
alter table public.ig_automacao drop constraint if exists ig_automacao_modo_check;
alter table public.ig_automacao add constraint ig_automacao_modo_check check (modo = 'botao');
grant all on public.roteiro, public.postagem, public.entrega, public.carrossel_trabalho, public.carrossel_post, public.criador, public.musica to authenticated, service_role;

notify pgrst, 'reload schema';
