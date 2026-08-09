import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profil } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function OnayBekliyor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/giris');

  const { data, error } = await supabase
    .from('profiller')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profil = data as Profil | null;

  if (profil?.onay_durumu === 'onayli' && profil.aktif) redirect('/');

  const reddedildi = profil?.onay_durumu === 'reddedildi' || profil?.aktif === false;

  return (
    <main className="giris-sarmal">
      <div className="giris-kart">
        <div className="giris-logo">
          <div className="logo-mark">AKC</div>
          <div>
            <div className="logo-ad">AKC HUKUK</div>
            <div className="logo-alt">
              {reddedildi ? 'Erişim kapalı' : 'Onay bekleniyor'}
            </div>
          </div>
        </div>

        {reddedildi ? (
          <div className="uyari hata">
            Bu hesabın panele erişimi bulunmuyor.
            <br />
            <br />
            Bir hata olduğunu düşünüyorsanız büro yöneticisiyle iletişime geçin.
          </div>
        ) : (
          <div className="uyari basari">
            <strong>{profil?.ad_soyad || user.email}</strong>
            <br />
            <br />
            Hesabınız oluşturuldu, büro yöneticisinin onayı bekleniyor. Onaylandıktan
            sonra bu sayfayı yenilediğinizde panele girebilirsiniz.
          </div>
        )}

        {/* Teşhis bilgisi — sorun çözülünce kaldırılabilir */}
        <details style={{ marginBottom: 16 }}>
          <summary className="soluk" style={{ cursor: 'pointer' }}>
            Teknik ayrıntı
          </summary>
          <pre
            style={{
              fontSize: 11.5,
              background: '#f4f5f7',
              padding: 10,
              borderRadius: 8,
              overflowX: 'auto',
              marginTop: 8,
            }}
          >
            {JSON.stringify(
              {
                oturum_id: user.id,
                oturum_mail: user.email,
                profil_bulundu: !!profil,
                profil_id: profil?.id ?? null,
                rol: profil?.rol ?? null,
                onay_durumu: profil?.onay_durumu ?? null,
                aktif: profil?.aktif ?? null,
                sorgu_hatasi: error?.message ?? null,
              },
              null,
              2
            )}
          </pre>
        </details>

        <form action="/auth/cikis" method="post">
          <button type="submit" className="btn ikincil genis">
            Çıkış yap
          </button>
        </form>
      </div>
    </main>
  );
}
