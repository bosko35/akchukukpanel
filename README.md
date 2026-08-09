# AKC Hukuk — Dosya Paylaşım Paneli

Next.js 15 + Supabase + Vercel. **Hiç e-posta göndermez** — kullanıcı kayıt olur,
yönetici onaylar, giriş şifreyle yapılır. Tek dosya veya klasörün tamamı
yüklenebilir; dosyalar varsayılan olarak herkese açık, istenirse kişi bazlı gizli.

**Maliyet:** Supabase Free (500 MB veritabanı, 1 GB dosya) + Vercel Hobby = **0 ₺**.
Alan büyüyünce Supabase Pro ~25 $/ay. SMTP/mail servisi gerekmez.

---

## Giriş akışı

```
Kişi /kayit → ad soyad + e-posta + şifre
        ↓
Hesap "onay bekliyor" durumunda oluşur, panele giremez
        ↓
Yönetici /kullanicilar → rolü seçer → Onayla
        ↓
Kişi /giris → e-posta + şifre ile girer
```

Alternatif: yönetici `/kullanicilar` ekranından **doğrudan hesap açabilir**
(mail + geçici şifre girer, hesap onaylı olarak oluşur, şifreyi kişiye kendisi
iletir).

**Şifre sıfırlama:** e-posta gönderilmediği için sıfırlama linki yoktur. Yönetici
`/kullanicilar` ekranından "Şifre sıfırla" der, sistem okunabilir bir geçici şifre
üretir, yönetici bunu kişiye iletir. Kullanıcı da üstteki "Şifre değiştir"
bağlantısından kendi şifresini değiştirebilir.

**Erişimi kesme:** "Erişimi kapat" hesabı pasifleştirir (dosyaları durur),
"Sil" hesabı ve yüklediği dosyaları kalıcı olarak siler.

Onay kontrolü hem sayfa seviyesinde hem RLS'te uygulanır — onaylanmamış bir
kullanıcı token'ıyla doğrudan API'ye gitse bile hiçbir dosya göremez.

## Erişim mantığı

Her dosya bir **alana** yüklenir. Alan, klasörün bir üstündeki erişim katmanıdır.

| Alan | Kim görür |
|---|---|
| **AKC Hukuk — Genel** (varsayılan) | Panele girebilen herkes |
| Genel + "belirli kişilerle paylaş" | Yükleyen + seçtiği kişiler + yönetici |
| **Kişisel alan** (örn. Buğra) | Alan sahibi + yükleyen + yönetici |

Alan listesi onaylı kullanıcılardan otomatik oluşur; yeni kişi onaylandığında
kendi alanı kendiliğinden belirir, kod değişikliği gerekmez.

Kural veritabanı seviyesinde (Postgres RLS) uygulanır — arayüz baypas edilse bile
yetkisiz kimse dosyayı çekemez. İndirme linkleri 60 saniye geçerli imzalı linklerdir,
depolama kovası tamamen kapalıdır. Her indirme `erisim_log` tablosuna yazılır.

---

## Kurulum

### 1. Supabase projesi

1. [supabase.com](https://supabase.com) → **New project**
2. Region: **Frankfurt (eu-central-1)** — KVKK açısından AB'de kalması iyi olur
3. **SQL Editor** → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**
4. Kurulum zaten yapılmışsa `supabase/` altındaki düzeltme dosyalarını sırayla çalıştır:
   `duzeltme-01-recursion.sql`, `duzeltme-02-klasor-yolu.sql`,
   `duzeltme-03-alan-ve-degistirme.sql`, `duzeltme-04-onay-sistemi.sql`
5. **Storage** → **New bucket** → isim: `dosyalar`, **Public bucket kapalı olsun**
6. **Project Settings → API**: `Project URL`, publishable key ve secret key'i kopyala

### 2. Auth ayarları

Sistem hiç mail göndermez, SMTP kurulumuna gerek yoktur. Hesaplar sunucu
tarafında `service_role` ile `email_confirm: true` olarak açılır.

**Authentication → Providers → Email**: `Confirm email` **kapalı** olsun.
(Doğrulama maili gönderilmeyecek; erişim kontrolü yönetici onayıyla yapılıyor.)

**Authentication → URL Configuration → Site URL**: `https://panel.akchukuk.com`

### 2b. İlk yöneticiyi belirle

Kendin `/kayit` üzerinden kayıt ol, sonra SQL Editor'de:

```sql
update public.profiller
  set rol = 'yonetici', onay_durumu = 'onayli', aktif = true
  where eposta = 'seninmailin@akchukuk.com';
```

Bundan sonrasını panelden `/kullanicilar` ekranıyla yönetirsin.

### 3. Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local   # anahtarları doldur
npm run dev
```

### 4. Vercel'e deploy

```bash
git init && git add . && git commit -m "AKC panel"
# GitHub'a push → Vercel → Import Project
```

Vercel → **Settings → Environment Variables** (hepsi Production + Preview):

| Değişken | Not |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | **Gizli.** Sadece sunucuda kullanılır |
| `NEXT_PUBLIC_SITE_URL` | `https://panel.akchukuk.com` |
| `SUPABASE_BUCKET` | `dosyalar` |

### 5. akchukuk.com bağlama

Vercel → **Settings → Domains** → `panel.akchukuk.com` ekle.
Domain sağlayıcınızda DNS kaydı:

```
CNAME   panel   cname.vercel-dns.com
```

Ana domaini (`akchukuk.com`) tanıtım sitesi olarak ayrı tutup paneli alt domainde
tutmak en temizi. SSL Vercel tarafından otomatik gelir.

---

## Kullanıcı yönetimi

Tamamı panelden, `/kullanicilar` ekranından yapılır (sadece yönetici görür):

| İşlem | Nasıl |
|---|---|
| Yeni kayıt onaylama | "Onay bekleyenler" listesinde rolü seç → **Onayla** |
| Doğrudan hesap açma | **Hesap aç** → mail + geçici şifre (otomatik üretilir) |
| Rol değiştirme | Satırdaki açılır listeden |
| Şifre sıfırlama | **Şifre sıfırla** → yeni şifre ekranda çıkar, kişiye siz iletirsiniz |
| Geçici erişim kesme | **Erişimi kapat** (hesap ve dosyalar durur) |
| Kalıcı silme | **Sil** (hesap + yüklediği dosyalar gider) |

Yönetici kendi rolünü düşüremez, kendi hesabını kapatamaz veya silemez.

---

## Dosya yapısı

```
app/
  giris/page.tsx            E-posta + şifre ile giriş
  kayit/page.tsx            Herkese açık kayıt (onay bekleyen hesap açar)
  onay-bekliyor/page.tsx    Onaylanmamış / erişimi kapalı kullanıcı ekranı
  kullanicilar/page.tsx     Yönetici: onaylama, rol, şifre sıfırlama, silme
  sifre-belirle/page.tsx    Kendi şifreni değiştirme
  auth/cikis/route.ts       Çıkış
  page.tsx                  Panel (sunucu tarafı veri çekimi + istatistikler)
  api/
    kayit/                  Mail göndermeden hesap açar (bekliyor durumunda)
    kullanicilar/           Yönetici: hesap açma
    kullanicilar/[id]/      Onay, rol, şifre, aktiflik, silme
    yukleme-linki/          İmzalı yükleme linki üretir
    dosyalar/               Kayıt oluşturma
    dosyalar/[id]/          Erişim güncelleme + silme
    dosyalar/[id]/degistir/ Yeni sürümle değiştirme
    indir/[id]/             Yetki kontrolü + imzalı indirme
    indirme-linkleri/       Toplu ZIP için imzalı linkler
components/
  KullaniciYonetimi.tsx     Yönetici ekranı
  SifreFormu.tsx            Şifre değiştirme formu
  YuklemeKarti.tsx          Tek dosya / klasör yükleme, ilerleme, alan seçimi
  DosyaListesi.tsx          Sekmeler, filtreler, gruplama, toplu işlemler
lib/supabase/               İstemci / sunucu / admin bağlantıları
lib/yetki.ts                Yönetici doğrulaması (sunucu tarafı)
middleware.ts               Oturum tazeleme + sayfa koruması
supabase/schema.sql         Tablolar, RLS, tetikleyiciler
supabase/duzeltme-*.sql     Sonradan eklenen migration'lar
```

## Panel özellikleri

- **Sekmeler:** Tüm dosyalar · Yüklediklerim · Gizli
- **Filtreler:** metin araması (dosya adı, klasör, açıklama, kişi), kişiye göre,
  klasöre göre
- **Gruplama:** dosyalar klasör/dava başlıkları altında toplanır, başlığa
  tıklanınca açılıp kapanır
- **Klasör yükleme:** "Klasör seç" ile bir klasörün tamamı tek seferde yüklenir;
  klasör adı otomatik doldurulur, alt klasör yolu `yol` kolonunda saklanır
- **Alan seçimi:** yüklerken Genel ya da bir kişinin alanı seçilir; listede alan
  rozetiyle görünür ve alana göre filtrelenir
- **Değiştir:** dosya satırındaki "Değiştir" ile yeni sürüm yüklenir. Kayıt aynı
  kalır (link, alan, klasör, izinler korunur), eski dosya depolamadan silinir,
  "… güncellendi" bilgisi satırda görünür ve `erisim_log`'a yazılır
- **Toplu işlem:** satır ve klasör başına seçim kutusu, "Tümünü seç"; seçilenler
  tek ZIP olarak indirilir (klasör yapısı korunur) veya toplu silinir. Silmede
  yetkiniz olmayan dosyalar otomatik atlanır.
- **Sınırlar:** dosya başına 50 MB, tek seferde 200 dosya yükleme, 300 dosya
  toplu indirme (kodda `MAX_BOYUT`, `MAX_ADET`). ZIP tarayıcıda oluşturulur;
  300 MB üstünde uyarı verir.

---

## Sonraki adım fikirleri

- **Mail entegrasyonu**: gelen davaları maille otomatik klasöre düşürmek (bir sonraki faz)
- Dosya sürüm geçmişi
- Yönetici için erişim log ekranı (`erisim_log` tablosu şimdiden doluyor)
- Klasörleri gerçek "dava" kaydına bağlayıp müvekkil/duruşma tarihi eklemek
- Yüklemede virüs taraması

---

## Güvenlik notları

- `SUPABASE_SERVICE_ROLE_KEY` asla `NEXT_PUBLIC_` ön ekiyle tanımlanmamalı.
- Depolama kovası private kalmalı; public yapılırsa RLS devre dışı kalır.
- Avukatlık sır saklama yükümlülüğü açısından verilerin AB bölgesinde tutulması ve
  büro içi bir aydınlatma metni hazırlanması önerilir. Bu bir hukuki tavsiye değildir;
  KVKK uyumunu kendi değerlendirmenizle teyit edin.
