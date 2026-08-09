-- Fallback "Uncategorized" bucket for each crew master-data table. When a
-- job position / job level / department / employment type is deleted, its crew
-- are reassigned here so no assignment is lost.
INSERT INTO public.departments (name) VALUES ('Uncategorized') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.job_positions (name) VALUES ('Uncategorized') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.employment_statuses (name) VALUES ('Uncategorized') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.job_levels (name) VALUES ('Uncategorized') ON CONFLICT (name) DO NOTHING;
