-- Migrate existing canceled issues to backlog
update public.issues set status = 'backlog' where status = 'canceled';

-- Drop old default first
ALTER TABLE public.issues ALTER COLUMN status DROP DEFAULT;

-- Create new enum without 'canceled'
CREATE TYPE issue_status_new AS ENUM ('backlog', 'todo', 'in_progress', 'done');

-- Switch column type, then set new default
ALTER TABLE public.issues ALTER COLUMN status TYPE issue_status_new USING status::text::issue_status_new;
ALTER TABLE public.issues ALTER COLUMN status SET DEFAULT 'backlog';

-- Drop old enum, rename new
DROP TYPE issue_status;
ALTER TYPE issue_status_new RENAME TO issue_status;
