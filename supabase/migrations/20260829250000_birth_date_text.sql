-- Birth date is entered as free text (DD/MM/YYYY) with an optional picker.
ALTER TABLE public.candidates ALTER COLUMN birth_date TYPE text USING birth_date::text;
