-- ============================================================
-- DÜZELTME 03 — Alan katmanı + dosya değiştirme
-- SQL Editor'e yapıştır → Run
-- ============================================================

-- ---------- 1) Yeni kolonlar ----------

-- Dosyanın hangi "alana" yüklendiği.
--   NULL          → AKC Hukuk Genel (herkes görür)
--   bir profil id  → o kişinin alanı (sadece o kişi + yükleyen + yönetici)
alter table public.dosyalar
  add column if not exists alan_sahibi uuid references public.profiller(id) on delete set null;

-- Dosya en son ne zaman ve kim tarafından değiştirildi
alter table public.dosyalar
  add column if not exists guncelleme_at timestamptz;

alter table public.dosyalar
  add column if not exists guncelleyen_id uuid references public.profiller(id) on delete set null;

create index if not exists dosyalar_alan_idx on public.dosyalar (alan_sahibi);

-- ---------- 2) Görünürlük kuralını güncelle ----------
--
--  Bir dosyayı görebilirsin, eğer:
--    - sen yüklediysen
--    - yöneticiysen
--    - dosya senin alanına yüklendiyse
--    - sana özel olarak paylaşıldıysa
--    - ya da Genel alandaysa ve gizli işaretlenmemişse

drop policy if exists "dosya oku" on public.dosyalar;
create policy "dosya oku" on public.dosyalar
  for select to authenticated
  using (
    sahip_id = auth.uid()
    or public.yoneticimi()
    or alan_sahibi = auth.uid()
    or public.dosya_izinim_var(id)
    or (alan_sahibi is null and gizli = false)
  );
