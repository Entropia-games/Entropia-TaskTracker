do $$
begin
  if not exists (select 1 from pg_type where typname = 'issue_type') then
    create type issue_type as enum ('task', 'bug', 'epic');
  end if;
end;
$$;

alter table public.issues add column if not exists issue_type issue_type not null default 'task';

-- Migrate existing epics
update public.issues set issue_type = 'epic' where is_epic = true;
