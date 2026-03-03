-- ============================================================
-- Enhancement: Owner can delete reports + associated storage
-- ============================================================

-- Allow owners to delete any cleaning_reports record
CREATE POLICY "Owners can delete reports" ON cleaning_reports FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);

-- Allow owners to delete photos from storage
CREATE POLICY "Owners can delete photos" ON storage.objects FOR DELETE USING (
    bucket_id = 'cleaning-photos'
    AND EXISTS (
        SELECT 1
        FROM users
        WHERE
            id = auth.uid ()
            AND role = 'owner'
    )
);