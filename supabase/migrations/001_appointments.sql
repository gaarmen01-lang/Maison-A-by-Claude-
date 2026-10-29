-- Table des rendez-vous de Maison A (appliquée sur le projet Supabase « Maison A - Claude »).

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  date date not null,
  time time not null,
  duration integer not null check (duration > 0 and duration <= 600),
  stylist text not null,
  stylist_requested boolean not null default false,
  service text not null,
  service_name jsonb not null,
  price numeric(10, 2) not null check (price >= 0),
  last_name text not null,
  first_name text not null,
  email text not null default '',
  phone text not null,
  notes text not null default '',
  lang text not null default 'fr' check (lang in ('fr', 'nl')),
  source text not null check (source in ('online', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  slot tsrange generated always as (
    tsrange(date + time, date + time + make_interval(mins => duration), '[)')
  ) stored,
  -- Une coiffeuse ne peut jamais avoir deux rendez-vous confirmés qui se chevauchent.
  constraint no_double_booking exclude using gist (stylist with =, slot with &&) where (status = 'confirmed')
);

create index appointments_date_idx on public.appointments (date);

-- Accès uniquement via le serveur du site : aucune politique pour les rôles publics de Supabase.
alter table public.appointments enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.appointments from anon, authenticated';
  end if;
end $$;

-- Rôle utilisé par le site (mot de passe défini à la création, stocké dans DATABASE_URL sur Vercel) :
--   create role maison_app login password '…' noinherit;
--   grant usage on schema public to maison_app;
--   grant select, insert, update, delete on public.appointments to maison_app;
--   create policy maison_app_all on public.appointments for all to maison_app using (true) with check (true);
