-- ГеоКрио ГИС — бакеты Supabase Storage и RLS-политики на storage.objects
-- Раздел 5 ТЗ описывал бакеты только текстом ("Авторизованные" / "Публичный"),
-- без этого файла любой авторизованный пользователь мог бы читать/писать чужие
-- объекты в любом бакете — RLS для storage.objects не наследуется из таблиц БД.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
    ('photos',     'photos',     false, 5242880),    -- 5 МБ
    ('thumbnails', 'thumbnails', false, 512000),      -- 500 КБ
    ('tiles',      'tiles',      true,  1048576),     -- 1 МБ, публичный для MapLibre
    ('exports',    'exports',    false, 52428800)     -- 50 МБ
ON CONFLICT (id) DO NOTHING;

-- PHOTOS / THUMBNAILS: читают и загружают все авторизованные,
-- изменять/удалять может только автор загрузки или админ.
CREATE POLICY "photos_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "photos_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "photos_update_own" ON storage.objects FOR UPDATE
    USING (bucket_id = 'photos' AND (owner = auth.uid() OR is_admin()));
CREATE POLICY "photos_delete_own" ON storage.objects FOR DELETE
    USING (bucket_id = 'photos' AND (owner = auth.uid() OR is_admin()));

CREATE POLICY "thumbnails_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'thumbnails' AND auth.uid() IS NOT NULL);
CREATE POLICY "thumbnails_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'thumbnails' AND auth.uid() IS NOT NULL);
CREATE POLICY "thumbnails_update_own" ON storage.objects FOR UPDATE
    USING (bucket_id = 'thumbnails' AND (owner = auth.uid() OR is_admin()));
CREATE POLICY "thumbnails_delete_own" ON storage.objects FOR DELETE
    USING (bucket_id = 'thumbnails' AND (owner = auth.uid() OR is_admin()));

-- TILES: публичное чтение (бакет public=true — нужно и для CDN, и явной политикой
-- для консистентности), загружает и правит только админ (панель загрузки слоёв).
CREATE POLICY "tiles_read_public" ON storage.objects FOR SELECT
    USING (bucket_id = 'tiles');
CREATE POLICY "tiles_admin_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'tiles' AND is_admin());
CREATE POLICY "tiles_admin_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'tiles' AND is_admin());
CREATE POLICY "tiles_admin_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'tiles' AND is_admin());

-- EXPORTS: доступ только к своей папке {user_id}/...
CREATE POLICY "exports_own_read" ON storage.objects FOR SELECT
    USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "exports_own_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "exports_own_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);
