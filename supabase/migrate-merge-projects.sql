-- Merge DefaultProject (1) into Hunger (2), then swap Hunger to id=1
-- Run in Supabase SQL Editor

DO $$
BEGIN
  -- 1. Move all data from DefaultProject (1) → Hunger (2)
  UPDATE public.issues SET project_id = 2 WHERE project_id = 1;
  UPDATE public.milestones SET project_id = 2 WHERE project_id = 1;

  DELETE FROM public.timeline_entries te
    WHERE te.project_id = 1
    AND EXISTS (SELECT 1 FROM public.timeline_entries t2 WHERE t2.project_id = 2 AND t2.issue_id = te.issue_id);
  UPDATE public.timeline_entries SET project_id = 2 WHERE project_id = 1;

  UPDATE public.doc_sections SET project_id = 2 WHERE project_id = 1;
  UPDATE public.documents SET project_id = 2 WHERE project_id = 1;

  DELETE FROM public.project_members pm
    WHERE pm.project_id = 1
    AND EXISTS (SELECT 1 FROM public.project_members p2 WHERE p2.project_id = 2 AND p2.user_id = pm.user_id);
  UPDATE public.project_members SET project_id = 2 WHERE project_id = 1;

  -- 2. Delete DefaultProject (frees id=1)
  DELETE FROM public.projects WHERE id = 1;

  -- 3. Swap Hunger from id=2 → id=1 (disable FK checks temporarily)
  SET session_replication_role = 'replica';

  UPDATE public.issues SET project_id = 1 WHERE project_id = 2;
  UPDATE public.milestones SET project_id = 1 WHERE project_id = 2;
  UPDATE public.timeline_entries SET project_id = 1 WHERE project_id = 2;
  UPDATE public.doc_sections SET project_id = 1 WHERE project_id = 2;
  UPDATE public.documents SET project_id = 1 WHERE project_id = 2;
  UPDATE public.project_members SET project_id = 1 WHERE project_id = 2;
  UPDATE public.projects SET id = 1 WHERE id = 2;

  SET session_replication_role = 'origin';

  -- 4. Recalculate display_id for issues
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM public.issues WHERE project_id = 1
  )
  UPDATE public.issues i SET display_id = r.rn
  FROM ranked r WHERE i.id = r.id;

  RAISE NOTICE 'Done. Hunger is now id=1, DefaultProject deleted.';
END $$;
