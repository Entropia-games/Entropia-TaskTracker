-- Add the "CM" team to the issue_team enum so issues can be assigned to it.
-- NOTE: Postgres does not allow ALTER TYPE ... ADD VALUE inside a transaction.
-- Run this as a single statement in the Supabase SQL Editor.
alter type public.issue_team add value if not exists 'CM';
