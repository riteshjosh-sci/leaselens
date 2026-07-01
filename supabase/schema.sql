-- ============================================================
-- LeaseLens — Supabase Schema
-- Run this in the Supabase SQL editor to set up the database
-- ============================================================

-- NEGOTIATIONS
-- Groups all document versions for one property/deal
create table negotiations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  property_name text,
  status      text default 'active',
  created_at  timestamptz default now()
);

-- DOCUMENTS
-- One row per uploaded file (each version of an HOA is a new row)
create table documents (
  id              uuid primary key default gen_random_uuid(),
  negotiation_id  uuid references negotiations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade not null,
  filename        text not null,
  file_path       text,
  version_number  integer default 1,
  uploaded_at     timestamptz default now(),
  overall_risk    text check (overall_risk in ('HIGH', 'MEDIUM', 'LOW'))
);

-- REPORTS
-- Full JSON report from Claude API
create table reports (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  report_json jsonb not null,
  created_at  timestamptz default now()
);

-- CLAUSES
-- Denormalised clause data for future analytics/RAG
create table clauses (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid references documents(id) on delete cascade not null,
  name                text,
  danger              text check (danger in ('HIGH', 'MEDIUM', 'LOW')),
  location            text,
  quote               text,
  risk                text,
  context             text,
  legislation         text,
  counter             text,
  -- Phase 3 analytics columns (nullable, populated where available)
  state               text,
  clause_type         text,
  rent_review_pct     numeric,
  rent_review_type    text,
  lease_term_years    numeric,
  bank_guarantee_months numeric,
  outgoings_sqm       numeric,
  incentive_type      text,
  incentive_pct       numeric,
  property_state      text,
  centre_type         text,
  danger_level        text
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can only read/write their own data
-- ============================================================

alter table negotiations enable row level security;
alter table documents     enable row level security;
alter table reports       enable row level security;
alter table clauses       enable row level security;

create policy "Users own negotiations"
  on negotiations for all using (auth.uid() = user_id);

create policy "Users own documents"
  on documents for all using (auth.uid() = user_id);

create policy "Users own reports"
  on reports for all using (auth.uid() = user_id);

create policy "Users own clauses"
  on clauses for all using (
    document_id in (select id from documents where user_id = auth.uid())
  );

-- LEASE_DATA
-- Deterministic regex-extracted commercial terms (no user_id column — access via document FK)
create table lease_data (
  id                          uuid primary key default gen_random_uuid(),
  document_id                 uuid references documents(id) on delete cascade,
  document_type               text,
  state                       text,
  base_rent_annual            numeric,
  term_years                  numeric,
  option_terms                numeric,
  bank_guarantee_months       numeric,
  make_good                   text,
  marketing_levy_annual       numeric,
  fitout_contribution         numeric,
  rent_free_months            numeric,
  personal_guarantee          text,
  permitted_use               text,
  exclusivity                 text,
  relocation_clause           boolean,
  outgoings_annual            numeric,
  rent_review_rate            numeric,
  rent_review_type            text,
  prompt_injection_detected   boolean default false,
  suspicious_content          boolean default false,
  security_notes              text,
  created_at                  timestamptz default now()
);

alter table lease_data enable row level security;

create policy "Users own lease_data"
  on lease_data for all
  using (
    document_id in (select id from documents where user_id = auth.uid())
  );

-- ============================================================
-- STORAGE BUCKET
-- Private bucket — files only accessible to owning user
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);

create policy "Users can upload their own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
