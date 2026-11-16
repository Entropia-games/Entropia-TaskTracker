-- Add the 'in_review' status between 'in_progress' and 'done'
alter type public.issue_status add value if not exists 'in_review' before 'done';
