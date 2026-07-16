-- Merge project id=2 (Hunger) into id=1
-- Run in Supabase SQL Editor.

-- 1. Create target project first (so FK constraints are satisfied)
INSERT INTO public.projects (id, name, code)
OVERRIDING SYSTEM VALUE
VALUES (1, 'Hunger', 'HUN')
ON CONFLICT (id) DO UPDATE SET name = 'Hunger', code = 'HUN';

-- 2. Move all child records from project 2 → 1
UPDATE public.project_members SET project_id = 1 WHERE project_id = 2;
UPDATE public.milestones SET project_id = 1 WHERE project_id = 2;
UPDATE public.issues SET project_id = 1 WHERE project_id = 2;
UPDATE public.timeline_entries SET project_id = 1 WHERE project_id = 2;
UPDATE public.doc_sections SET project_id = 1 WHERE project_id = 2;
UPDATE public.documents SET project_id = 1 WHERE project_id = 2;

-- 3. Delete old project (cascades to any remaining children)
DELETE FROM public.projects WHERE id = 2;

-- 4. Verify
SELECT 'projects' AS tbl, id, name, code FROM public.projects ORDER BY id;
