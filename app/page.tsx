import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import YuklemeKarti from '@/components/YuklemeKarti';
import DosyaListesi from '@/components/DosyaListesi';
import type { Dosya, DosyaSatiri, Profil } from '@/lib/types';

export const dynamic = 'force-dynamic';

function boyutYazi(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(0)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function Panel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/giris');

  const { data: benimProfilim } = await supabase
    .from('profiller')
    .select('*')
    .eq('id', user.id)
    .single();

  const profil = benimProfilim as Profil | null;

  // Onaylanmamış veya erişimi kapatılmış kullanıcı panele giremez
  if (!profil || profil.onay_durumu !== 'onayli' || !profil.aktif) {
    redirect('/onay-bekliyor');
  }

  const [{ data: profiller }, { data: dosyalar }] = await Promise.all([
    supabase
      .from('profiller')
      .select('*')
      .eq('aktif', true)
      .eq('onay_durumu', 'onayli')
      .order('ad_soyad'),
    supabase.from('dosyalar').select('*').order('created_at', { ascending: false }),
  ]);

  const ekip = (profiller || []) as Profil[];
  const rol = profil.rol;
  const yonetici = rol === 'yonetici';

  const { data: izinler } = await supabase
    .from('dosya_izinleri')
    .select('dosya_id, kullanici_id');

  const izinHarita = new Map<string, string[]>();
  for (const i of izinler || []) {
    const mevcut = izinHarita.get(i.dosya_id) || [];
    mevcut.push(i.kullanici_id);
    izinHarita.set(i.dosya_id, mevcut);
  }

  const adHarita = new Map(ekip.map((p) => [p.id, p.ad_soyad || p.eposta]));

  const satirlar: DosyaSatiri[] = ((dosyalar || []) as Dosya[]).map((d) => ({
    ...d,
    sahip_ad: adHarita.get(d.sahip_id) || 'Bilinmiyor',
    alan_ad: d.alan_sahibi
      ? d.alan_sahibi === user.id
        ? 'Benim alanım'
        : adHarita.get(d.alan_sahibi) || 'Kişisel alan'
      : 'Genel',
    izinliler: izinHarita.get(d.id) || [],
    duzenleyebilir: d.sahip_id === user.id || yonetici,
  }));

  const klasorler = Array.from(new Set(satirlar.map((d) => d.klasor))).sort((a, b) =>
    a.localeCompare(b, 'tr')
  );

  const benimSayim = satirlar.filter((d) => d.sahip_id === user.id).length;
  const toplamBoyut = satirlar.reduce((t, d) => t + (d.boyut || 0), 0);
  const adSoyad = profil.ad_soyad || user.email || '';

  return (
    <>
      <header className="ust-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="logo-mark">AKC</div>
          <div>
            <div className="logo-ad">AKC HUKUK</div>
            <div className="logo-alt">Dosya Paneli</div>
          </div>
        </div>

        <div className="kullanici">
          <div className="kullanici-ad">
            <strong>{adSoyad}</strong>
            <span>{rol}</span>
          </div>
          {yonetici && (
            <Link href="/kullanicilar" className="cikis-btn">
              Kullanıcılar
            </Link>
          )}
          <Link href="/sifre-belirle?yenile=1" className="cikis-btn">
            Şifre değiştir
          </Link>
          <form action="/auth/cikis" method="post">
            <button type="submit" className="cikis-btn">
              Çıkış
            </button>
          </form>
        </div>
      </header>

      <main className="icerik">
        <div className="istatistik">
          <div className="ist-kutu">
            <div className="sayi">{satirlar.length}</div>
            <div className="etiket">Erişebildiğiniz dosya</div>
          </div>
          <div className="ist-kutu">
            <div className="sayi">{klasorler.length}</div>
            <div className="etiket">Klasör / dava</div>
          </div>
          <div className="ist-kutu">
            <div className="sayi">{benimSayim}</div>
            <div className="etiket">
              Sizin yüklediğiniz{toplamBoyut ? ` · ${boyutYazi(toplamBoyut)}` : ''}
            </div>
          </div>
        </div>

        <div className="grid">
          <YuklemeKarti ekip={ekip} benimId={user.id} klasorler={klasorler} />
          <DosyaListesi
            dosyalar={satirlar}
            ekip={ekip}
            benimId={user.id}
            klasorler={klasorler}
          />
        </div>
      </main>
    </>
  );
}
