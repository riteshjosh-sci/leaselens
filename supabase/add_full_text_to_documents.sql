-- Add full_text column to documents table for full-doc AI comparison (Step 2)
alter table documents add column if not exists full_text text;
