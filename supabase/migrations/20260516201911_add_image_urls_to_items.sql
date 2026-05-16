ALTER TABLE "public"."items" ADD COLUMN "image_urls" text[] DEFAULT '{}'::text[];

INSERT INTO storage.buckets (id, name, public) VALUES ('item_images', 'item_images', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'item_images' );
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'item_images' );
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING ( bucket_id = 'item_images' );
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'item_images' );
