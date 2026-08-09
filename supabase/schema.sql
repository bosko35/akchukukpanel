-- ============================================================
-- AKC Hukuk Panel — Supabase şeması
-- Supabase Dashboard → SQL Editor → bu dosyanın tamamını yapıştır → Run
-- ============================================================

-- ---------- 1) TABLOLAR ----------

-- Kullanıcı profilleri (auth.users ile 1-1)
create table if not exists public.profiller (
  id          uuid primary key references auth.users(id) on delete cascade,
  eposta      text not null,
  ad_soyad    text,
  rol         text not null default 'stajyer'
              check (rol in ('yonetici', 'avukat', 'stajyer')),
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Dosyalar
create table if not exists public.dosyalar (
  id            uuid primary key default gen_random_uuid(),
  ad            text not null,
  storage_path  text not null unique,
  boyut         bigint,
  mime          text,
  klasor        text not null default 'Genel',
  aciklama      text,
  -- false  => panele girebilen HERKES görür (varsayılan)
  -- true   => sadece yükleyen + dosya_izinleri'ndeki kişiler + yönetici görür
  gizli         boolean not null default false,
  sahip_id      uuid not null references public.profiller(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists dosyalar_klasor_idx on public.dosyalar (klasor);
create index if not exists dosyalar_created_idx on public.dosyalar (created_at desc);

-- Gizli dosyalara kişi bazlı erişim
create table if not exists public.dosya_izinleri (
  dosya_id     uuid not null references public.dosyalar(id) on delete cascade,
  kullanici_id uuid not null references public.profiller(id) on delete cascade,
  primary key (dosya_id, kullanici_id)
);

-- İndirme/erişim kaydı (hukuk bürosu için denetim izi)
create table if not exists public.erisim_log (
  id           bigserial primary key,
  dosya_id     uuid references public.dosyalar(id) on delete set null,
  kullanici_id uuid references public.profiller(id) on delete set null,
  eylem        text not null, -- 'indirme' | 'yukleme' | 'silme'
  created_at   timestamptz not null default now()
);

-- ---------- 2) YENİ KULLANICI → PROFİL TETİKLEYİCİSİ ----------

create or replace function public.yeni_kullanici_profili()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiller (id, eposta, ad_soyad)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'ad_soyad', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.yeni_kullanici_profili();

-- ---------- 3) YARDIMCI FONKSİYONLAR ----------

-- ÖNEMLİ: Bu fonksiyonlar "security definer" olduğu için RLS'i baypas ederler.
-- Politikalar birbirinin tablosunu doğrudan sorgularsa Postgres
-- "infinite recursion detected in policy" hatası verir; bu fonksiyonlar döngüyü kırar.

create or replace function public.yoneticimi()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiller
    where id = auth.uid() and rol = 'yonetici' and aktif = true
  );
$$;

-- Bu dosyanın sahibi ben miyim?
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

-- Bu gizli dosya bana özel olarak paylaşıldı mı?
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

-- ---------- 4) RLS ----------

alter table public.profiller      enable row level security;
alter table public.dosyalar       enable row level security;
alter table public.dosya_izinleri enable row level security;
alter table public.erisim_log     enable row level security;

-- PROFİLLER: giriş yapmış herkes ekip listesini görebilir (paylaşım için gerekli)
drop policy if exists "profil oku" on public.profiller;
create policy "profil oku" on public.profiller
  for select to authenticated using (true);

drop policy if exists "kendi profilini guncelle" on public.profiller;
create policy "kendi profilini guncelle" on public.profiller
  for update to authenticated
  using (id = auth.uid() or public.yoneticimi())
  with check (id = auth.uid() or public.yoneticimi());

-- DOSYALAR: görünürlük kuralı
drop policy if exists "dosya oku" on public.dosyalar;
create policy "dosya oku" on public.dosyalar
  for select to authenticated
  using (
    gizli = false
    or sahip_id = auth.uid()
    or public.yoneticimi()
    or public.dosya_izinim_var(id)
  );

drop policy if exists "dosya ekle" on public.dosyalar;
create policy "dosya ekle" on public.dosyalar
  for insert to authenticated
  with check (sahip_id = auth.uid());

drop policy if exists "dosya guncelle" on public.dosyalar;
create policy "dosya guncelle" on public.dosyalar
  for update to authenticated
  using (sahip_id = auth.uid() or public.yoneticimi())
  with check (sahip_id = auth.uid() or public.yoneticimi());

drop policy if exists "dosya sil" on public.dosyalar;
create policy "dosya sil" on public.dosyalar
  for delete to authenticated
  using (sahip_id = auth.uid() or public.yoneticimi());

-- DOSYA İZİNLERİ: sadece dosyanın sahibi (veya yönetici) yönetir
drop policy if exists "izin oku" on public.dosya_izinleri;
create policy "izin oku" on public.dosya_izinleri
  for select to authenticated
  using (
    kullanici_id = auth.uid()
    or public.yoneticimi()
    or public.dosya_sahibim(dosya_id)
  );

drop policy if exists "izin yaz" on public.dosya_izinleri;
create policy "izin yaz" on public.dosya_izinleri
  for insert to authenticated
  with check (
    public.yoneticimi()
    or public.dosya_sahibim(dosya_id)
  );

drop policy if exists "izin sil" on public.dosya_izinleri;
create policy "izin sil" on public.dosya_izinleri
  for delete to authenticated
  using (
    public.yoneticimi()
    or public.dosya_sahibim(dosya_id)
  );

-- LOG: sadece yönetici okur, yazma sunucu tarafında (service role) yapılır
drop policy if exists "log oku" on public.erisim_log;
create policy "log oku" on public.erisim_log
  for select to authenticated using (public.yoneticimi());

-- ---------- 5) DEPOLAMA ----------
-- Supabase Dashboard → Storage → New bucket
--   Name: dosyalar
--   Public bucket: KAPALI (private olmalı!)
-- Storage için ekstra policy GEREKMEZ: yükleme signed-upload-url ile,
-- indirme ise sunucudaki yetki kontrolünden sonra signed-url ile yapılır.

-- ---------- 6) İLK YÖNETİCİYİ ATA ----------
-- Kendi mailinle giriş yaptıktan sonra bu satırı çalıştır:
-- update public.profiller set rol = 'yonetici' where eposta = 'seninmailin@akchukuk.com';
