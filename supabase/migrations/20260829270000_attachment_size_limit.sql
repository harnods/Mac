-- Cap public application attachments at 2MB each. The apply form uploads
-- résumés and photos straight from the browser to Storage, so the bucket limit
-- is the real guard — the client-side check is only there for a nicer message.
UPDATE storage.buckets
SET file_size_limit = 2097152
WHERE id IN ('resumes', 'candidate-photos');
