-- ============================================================
-- DÜZELTME 04 — Kayıt + yönetici onayı (mail gerektirmeyen akış)
-- SQL Editor'e yapıştır → Run
-- ============================================================

-- ---------- 1) Onay durumu ----------

alter table public.profiller
  add column if not exists onay_durumu text not null default 'bekliyor';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiller_onay_durumu_check'
  ) then
    alter table public.profiller
      add constraint profiller_onay_durumu_check
      check (onay_durumu in ('bekliyor', 'onayli', 'reddedildi'));
  end if;
end $$;

-- Mevcut kullanıcıları onaylı yap (yeni gelenler 'bekliyor' olacak)
update public.profiller set onay_durumu = 'onayli' where onay_durumu = 'bekliyor';

create index if not exists profiller_onay_idx on public.profiller (onay_durumu);

-- ---------- 2) Yardımcı fonksiyon ----------

create or replace function public.onayli()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiller
    where id = auth.uid()
      and aktif = true
      and onay_durumu = 'onayli'
  );
$$;

-- ---------- 3) Politikalara onay şartı ekle ----------
-- Onaylanmamış kullanıcı hiçbir dosyayı göremez, ekleyemez.

drop policy if exists "dosya oku" on public.dosyalar;
create policy "dosya oku" on public.dosyalar
  for select to authenticated
  using (
    public.onayli()
    and (
      sahip_id = auth.uid()
      or public.yoneticimi()
      or alan_sahibi = auth.uid()
      or public.dosya_izinim_var(id)
      or (alan_sahibi is null and gizli = false)
    )
  );

drop policy if exists "dosya ekle" on public.dosyalar;
create policy "dosya ekle" on public.dosyalar
  for insert to authenticated
  with check (sahip_id = auth.uid() and public.onayli());

drop policy if exists "dosya guncelle" on public.dosyalar;
create policy "dosya guncelle" on public.dosyalar
  for update to authenticated
  using (public.onayli() and (sahip_id = auth.uid() or public.yoneticimi()))
  with check (public.onayli() and (sahip_id = auth.uid() or public.yoneticimi()));

drop policy if exists "dosya sil" on public.dosyalar;
create policy "dosya sil" on public.dosyalar
  for delete to authenticated
  using (public.onayli() and (sahip_id = auth.uid() or public.yoneticimi()));

-- Profil listesi: onaylı kullanıcılar ekibi görür, herkes kendini görür
drop policy if exists "profil oku" on public.profiller;
create policy "profil oku" on public.profiller
  for select to authenticated
  using (id = auth.uid() or public.onayli() or public.yoneticimi());

-- ---------- 4) Yönetici de onaylı sayılmalı ----------
create or replace function public.yoneticimi()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiller
    where id = auth.uid()
      and rol = 'yonetici'
      and aktif = true
      and onay_durumu = 'onayli'
  );
$$;

-- ---------- 5) Yeni kullanıcı tetikleyicisi ----------
create or replace function public.yeni_kullanici_profili()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiller (id, eposta, ad_soyad, onay_durumu, sifre_belirlendi)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'ad_soyad', split_part(new.email, '@', 1)),
    'bekliyor',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------- 6) İLK YÖNETİCİYİ ATA ----------
-- Kendi mailini yazıp çalıştır:
-- update public.profiller
--   set rol = 'yonetici', onay_durumu = 'onayli', aktif = true
--   where eposta = 'seninmailin@akchukuk.com';
