-- Creator System · 002 · roteiros pra teleprompter
--
-- Cole este arquivo no SQL Editor do seu Supabase e clique em Run (ou: npm run migrar). Pode rodar
-- de novo sem medo: só cria o que falta.
--
-- Roteiro pronto pra ler no teleprompter, no padrão dos vídeos que viralizam e com checagem anti-IA:
--   · sobre um tema;
--   · a partir de um vídeo de referência (arquivo ou link do Instagram): o painel transcreve e tira
--     o assunto, o ângulo e a estrutura; o roteiro sai NOVO (quem escreve nunca vê as falas do
--     outro criador);
--   · a partir de um reel da Esteira (reaproveita a transcrição que a Esteira já fez).
-- Quem escreve é a estação no seu PC, com a mesma IA que edita os vídeos. Ela entra com o seu
-- login: a RLS da equipe (abaixo) já deixa ela pegar o pedido, gravar o roteiro e bater o ponto em
-- configuracao. A estação não mexe em arquivo nenhum aqui: o vídeo de referência vai do navegador
-- pro bucket "esteira" (roteiro/<id>/…) por link assinado, quem lê é o servidor, e ele apaga o
-- arquivo assim que vira transcrição.

create table if not exists public.roteiro (
  id                uuid primary key default gen_random_uuid(),
  titulo            text,
  origem            text not null check (origem in ('tema', 'arquivo', 'link', 'esteira')),
  tema              text,
  direcao           text,
  palavra_cta       text,
  duracao_alvo      integer not null default 45 check (duracao_alvo between 15 and 180),
  link              text,
  referencia_id     uuid references public.referencia (id) on delete set null,
  arquivo           text,
  arquivo_tipo      text,
  arquivo_nome      text,
  status            text not null default 'na_fila'
                    check (status in ('subindo', 'na_fila', 'transcrevendo', 'aguardando_estacao', 'escrevendo', 'pronto', 'erro')),
  etapa             text,
  transcricao       jsonb,                          -- {duracao_seg, fala: [{t, texto}], cenas, audio, fonte}
  analise           jsonb,                          -- assunto, ângulo, gancho e estrutura, em abstrato (sem as falas)
  versoes           jsonb not null default '[]',    -- os roteiros gerados, o mais novo primeiro (até 5)
  erro              text,
  estacao           text,                           -- a máquina que pegou o pedido
  processando_desde timestamptz,
  custo_usd         numeric(10, 4) not null default 0,
  criado_por        uuid,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists roteiro_criado_idx on public.roteiro (criado_em desc);
create index if not exists roteiro_referencia_idx on public.roteiro (referencia_id) where referencia_id is not null;
create index if not exists roteiro_fila_idx on public.roteiro (criado_em) where status = 'aguardando_estacao';

-- Segurança: a mesma regra das outras tabelas (só quem é da equipe; a estação entra como você)
alter table public.roteiro enable row level security;
grant all on public.roteiro to authenticated, service_role;
revoke all on public.roteiro from anon;
drop policy if exists equipe_tudo on public.roteiro;
create policy equipe_tudo on public.roteiro for all to authenticated
  using ((select criador_privado.eh_da_equipe()))
  with check ((select criador_privado.eh_da_equipe()));

drop trigger if exists tocar_atualizado_em on public.roteiro;
create trigger tocar_atualizado_em before update on public.roteiro
  for each row execute function public.tocar_atualizado_em();

insert into public.configuracao (chave, valor, descricao) values
  ('estacao_roteiros', '{"visto_em": null, "maquina": null, "ocupada": false}', 'Batida da parte da estação que escreve os roteiros (o seu PC)')
on conflict (chave) do nothing;
-- O guia do padrão viral (configuracao "padrao_viral") só aparece quando você salva em
-- Roteiros → Padrão viral; até lá vale o padrão do sistema.
