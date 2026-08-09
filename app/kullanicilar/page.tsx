import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { yoneticiMi } from '@/lib/yetki';
import KullaniciYonetimi from '@/components/KullaniciYonetimi';
import type { Profil } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function KullanicilarSayfasi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/giris');

  const yid = await yoneticiMi();
  if (!yid) redirect('/');

  // Yönetici tüm profilleri görebilmeli — RLS'i baypas ediyoruz
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiller')
    .select('*')
    .order('onay_durumu', { ascending: true })
    .order('created_at', { ascending: false });

  const kullanicilar = (data || []) as Profil[];
  const bekleyen = kullanicilar.filter((k) => k.onay_durumu === 'bekliyor').length;

  return (
    <>
      <header className="ust-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="logo-mark">AKC</div>
          <div>
            <div className="logo-ad">AKC HUKUK</div>
            <div className="logo-alt">Kullanıcı Yönetimi</div>
          </div>
        </div>

        <div className="kullanici">
          <Link href="/" className="cikis-btn">
            Panele dön
          </Link>
          <form action="/auth/cikis" method="post">
            <button type="submit" className="cikis-btn">
              Çıkış
            </button>
          </form>
        </div>
      </header>

      <main className="icerik" style={{ maxWidth: 980 }}>
        {bekleyen > 0 && (
          <div className="uyari basari" style={{ marginBottom: 18 }}>
            {bekleyen} hesap onayınızı bekliyor.
          </div>
        )}

        <KullaniciYonetimi kullanicilar={kullanicilar} benimId={yid} />
      </main>
    </>
  );
}
