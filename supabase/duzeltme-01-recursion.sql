-- ============================================================
-- DÜZELTME 01 — "infinite recursion detected in policy for relation dosyalar"
--
-- Sebep: dosyalar politikası dosya_izinleri'ni, dosya_izinleri politikası da
-- dosyalar'ı sorguluyordu. Postgres bunu sonsuz döngü olarak algılıyor.
-- Çözüm: aradaki sorguları RLS'i baypas eden security-definer fonksiyonlara taşımak.
--
-- SQL Editor'e yapıştır → Run. schema.sql'i baştan çalıştırmana gerek yok.
-- ============================================================

create or replace function public.dosya_sahibim(d_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.dosyalar
    where id = d_id and sahip_id = auth.uid()
  );
$$;

create or replace function public.dosya_izinim_var(d_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.dosya_izinleri
    where dosya_id = d_id and kullanici_id = auth.uid()
  );
$$;

-- dosyalar: görünürlük
drop policy if exists "dosya oku" on public.dosyalar;
create policy "dosya oku" on public.dosyalar
  for select to authenticated
  using (
    gizli = false
    or sahip_id = auth.uid()
    or public.yoneticimi()
    or public.dosya_izinim_var(id)
  );

-- dosya_izinleri: okuma
drop policy if exists "izin oku" on public.dosya_izinleri;
create policy "izin oku" on public.dosya_izinleri
  for select to authenticated
  using (
    kullanici_id = auth.uid()
    or public.yoneticimi()
    or public.dosya_sahibim(dosya_id)
  );

-- dosya_izinleri: ekleme
drop policy if exists "izin yaz" on public.dosya_izinleri;
create policy "izin yaz" on public.dosya_izinleri
  for insert to authenticated
  with check (
    public.yoneticimi()
    or public.dosya_sahibim(dosya_id)
  );

-- dosya_izinleri: silme
drop policy if exists "izin sil" on public.dosya_izinleri;
create policy "izin sil" on public.dosya_izinleri
  for delete to authenticated
  using (
    public.yoneticimi()
    or public.dosya_sahibim(dosya_id)
  );
