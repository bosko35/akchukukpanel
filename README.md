# AKC Hukuk — Dosya Paylaşım Paneli

Next.js 15 + Supabase + Vercel. Davet edilen kullanıcılar ilk girişi maildeki linkle
yapar, kendi şifresini belirler, sonraki girişlerde şifreyle girer. Tek dosya veya
klasörün tamamı yüklenebilir; dosyalar varsayılan olarak herkese açık, istenirse
kişi bazlı gizli.

**Maliyet:** Supabase Free (500 MB veritabanı, 1 GB dosya, aylık ~3.000 giriş maili) +
Vercel Hobby = **0 ₺**. Alan büyüyünce Supabase Pro ~25 $/ay.

---

## Giriş akışı

```
Yönetici Supabase'den kullanıcıyı davet eder
        ↓
Kullanıcı /giris → "İlk giriş / şifremi unuttum" → mailine link gelir
        ↓
Linke tıklar → /sifre-belirle → ad soyad + şifre belirler
        ↓
Bundan sonra /giris → e-posta + şifre
```

Giriş linki **sadece Supabase Authentication → Users listesinde kayıtlı maillere**
gider. Kayıtlı olmayan biri mailini yazarsa link gönderilmez, uyarı görür
(`shouldCreateUser: false`). Şifresini belirlemeyen kullanıcı panele giremez,
middleware onu `/sifre-belirle` sayfasına yönlendirir.

Şifre sıfırlama için ayrı bir ekran yok — kullanıcı yine "şifremi unuttum" ile
link ister, girer, yeni şifresini belirler.

## Erişim mantığı

Her dosya bir **alana** yüklenir. Alan, klasörün bir üstündeki erişim katmanıdır.

| Alan | Kim görür |
|---|---|
| **AKC Hukuk — Genel** (varsayılan) | Panele girebilen herkes |
| Genel + "belirli kişilerle paylaş" | Yükleyen + seçtiği kişiler + yönetici |
| **Kişisel alan** (örn. Buğra) | Alan sahibi + yükleyen + yönetici |

Alan listesi Supabase'deki aktif kullanıcılardan otomatik oluşur; yeni kişi davet
edildiğinde kendi alanı kendiliğinden belirir, kod değişikliği gerekmez.

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
   `duzeltme-03-alan-ve-degistirme.sql`
5. **Storage** → **New bucket** → isim: `dosyalar`, **Public bucket kapalı olsun**
6. **Project Settings → API**: `Project URL`, publishable key ve secret key'i kopyala

### 2. Mail şablonu (Türkçeleştirme + doğru link)

**Authentication → Email Templates → Magic Link**:

```html
<h2>AKC Hukuk Paneli</h2>
<p>Şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın:</p>
<p>
  <a href="{{ .SiteURL }}/auth/dogrula?token_hash={{ .TokenHash }}&type=magiclink">
    Devam et
  </a>
</p>
<p>Bu bağlantı 1 saat geçerlidir. Bu isteği siz yapmadıysanız maili yok sayın.</p>
```

Aynı içeriği **Invite user** şablonuna da koyun (`type=invite` olarak) ki davet
maili de doğru sayfaya düşsün.

**Authentication → URL Configuration**:
- Site URL: `https://panel.akchukuk.com`
- Redirect URLs: `https://panel.akchukuk.com/**` ve `http://localhost:3000/**`

**Authentication → Providers → Email**: `Confirm email` açık, `Enable email signups` kapalı
(kimse kendi kendine kayıt olamasın — kullanıcıları siz davet edersiniz).

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

## Kullanıcı ekleme

Supabase → **Authentication → Users → Invite user** → kurumsal maili gir.
Kişi davet mailindeki linke tıklayınca profili otomatik oluşur (`rol = stajyer`).

Rol değiştirmek için SQL Editor:

```sql
update public.profiller set rol = 'avukat'    where eposta = 'eren@akchukuk.com';
update public.profiller set rol = 'yonetici'  where eposta = 'sen@akchukuk.com';
```

Ayrılan stajyerin erişimini kesmek için:

```sql
update public.profiller set aktif = false where eposta = 'stajyer@akchukuk.com';
```

(Tam kesmek için Authentication → Users → kullanıcıyı sil.)

---

## Dosya yapısı

```
app/
  giris/page.tsx            Şifreyle giriş + "ilk giriş / şifremi unuttum"
  sifre-belirle/page.tsx    Şifre belirleme (Suspense sarmalayıcı)
  auth/dogrula/route.ts     Maildeki linkin düştüğü yer
  auth/cikis/route.ts       Çıkış
  page.tsx                  Panel (sunucu tarafı veri çekimi + istatistikler)
  api/
    yukleme-linki/          İmzalı yükleme linki üretir
    dosyalar/               Kayıt oluşturma
    dosyalar/[id]/          Erişim güncelleme + silme
    indir/[id]/             Yetki kontrolü + imzalı indirme
components/
  SifreFormu.tsx            Şifre belirleme formu
  YuklemeKarti.tsx          Tek dosya / klasör yükleme, ilerleme, gizlilik
  DosyaListesi.tsx          Sekmeler, arama, kişi & klasör filtresi, gruplama
lib/supabase/               İstemci / sunucu / admin bağlantıları
middleware.ts               Oturum tazeleme + sayfa & şifre koruması
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
