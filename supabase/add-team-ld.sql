-- Add the "LD" team to the issue_team enum so issues can be assigned to it.
-- NOTE: Postgres does not allow ALTER TYPE ... ADD VALUE inside a transaction.
-- Run this as a single statement in the Supabase SQL Editor. If it errors with
-- "cannot run inside a transaction block", run it via the dashboard query tool
-- without wrapping in a transaction (or temporarily disable the transaction).
alter type public.issue_team add value if not exists 'LD';
