
-- CAHOS LESP v1 · aggregate-only protected active dataset
-- Operational rows are versioned just long enough to atomically publish replacements.
-- No nominal data, lab folios, CURP or report binaries belong in these tables.
create table if not exists public.cahos_lesp_versions (
 id uuid primary key default gen_random_uuid(),
 epi_year smallint not null check(epi_year between 2020 and 2100),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 source_label text not null check(char_length(source_label) between 3 and 160),
 source_unit text not null default 'positive_lab_results',
 temporal_basis text not null default 'fecha_emision_informe',
 territorial_basis text not null default 'procedencia_reportada',
 import_mode text not null default 'full_year_snapshot' check(import_mode='full_year_snapshot'),
 coverage_start smallint not null check(coverage_start between 1 and 53),
 coverage_end smallint not null check(coverage_end between 1 and 53 and coverage_end>=coverage_start),
 row_count integer not null check(row_count between 1 and 30000),
 positive_total bigint not null check(positive_total>=0),
 quality jsonb not null default '{}'::jsonb check(jsonb_typeof(quality)='object'),
 status text not null default 'staging' check(status in ('staging','ready','retired')),
 imported_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 unique(epi_year,source_hash),
 unique(id,epi_year)
);
create table if not exists public.cahos_lesp_counts (
 version_id uuid not null,
 epi_year smallint not null check(epi_year between 2020 and 2100),
 epi_week smallint not null check(epi_week between 1 and 53),
 municipality text not null check(char_length(municipality) between 2 and 110),
 pathology text not null check(char_length(pathology) between 2 and 110),
 positive_lab_results integer not null check(positive_lab_results between 0 and 1000000),
 constraint cahos_lesp_counts_version_fk foreign key(version_id,epi_year)
   references public.cahos_lesp_versions(id,epi_year) on delete cascade,
 primary key(version_id,epi_year,epi_week,municipality,pathology)
);
create index if not exists cahos_lesp_counts_period_idx
 on public.cahos_lesp_counts(version_id,epi_week,municipality,pathology);
create table if not exists public.cahos_lesp_active (
 epi_year smallint primary key check(epi_year between 2020 and 2100),
 version_id uuid not null,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 constraint cahos_lesp_active_version_fk foreign key(version_id,epi_year)
   references public.cahos_lesp_versions(id,epi_year)
);
create table if not exists public.cahos_lesp_audit (
 event_id uuid primary key default gen_random_uuid(),
 epi_year smallint not null,
 event_type text not null check(event_type in ('initial_load','publish','supersede','duplicate')),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 affected_rows integer not null default 0 check(affected_rows>=0),
 positive_total bigint not null default 0 check(positive_total>=0),
 actor_id uuid references auth.users(id),
 event_at timestamptz not null default now(),
 note text not null default '' check(char_length(note)<=500)
);
comment on table public.cahos_lesp_versions is
 'Private LESP metadata. Full-year validated aggregates; never source Excel or nominal records.';
comment on table public.cahos_lesp_counts is
 'Private LESP counts: positive lab RESULT candidates, not confirmed surveillance cases.';
comment on table public.cahos_lesp_active is
 'One current snapshot per epidemiological year; switch is a single atomic pointer update.';
comment on table public.cahos_lesp_audit is
 'Compact import audit. Superseded count rows are deleted; hashes and counts persist.';
alter table public.cahos_lesp_versions enable row level security;
alter table public.cahos_lesp_counts enable row level security;
alter table public.cahos_lesp_active enable row level security;
alter table public.cahos_lesp_audit enable row level security;
revoke all on table public.cahos_lesp_versions,
 public.cahos_lesp_counts,public.cahos_lesp_active,public.cahos_lesp_audit
 from public,anon,authenticated;
grant select,insert,update,delete on table public.cahos_lesp_versions,
 public.cahos_lesp_counts,public.cahos_lesp_active,public.cahos_lesp_audit
 to service_role;
