-- ============================================================
-- DÜZELTME 02 — Klasör yükleme desteği
-- SQL Editor'e yapıştır → Run
-- ============================================================

-- Klasör yüklendiğinde dosyanın klasör içindeki göreli yolu
-- (örn. "2026-143 Ticari Dava/Dilekceler/cevap.pdf")
alter table public.dosyalar
  add column if not exists yol text;

-- Şifre belirlenmiş mi? (raporlama için; asıl kontrol auth metadata'da)
alter table public.profiller
  add column if not exists sifre_belirlendi boolean not null default false;

create index if not exists dosyalar_sahip_idx on public.dosyalar (sahip_id);
