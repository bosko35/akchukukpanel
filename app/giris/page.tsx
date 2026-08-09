'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mod = 'sifre' | 'link';

export default function GirisSayfasi() {
  const router = useRouter();
  const [mod, setMod] = useState<Mod>('sifre');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const [linkGonderildi, setLinkGonderildi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function sifreyleGir(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: eposta.trim().toLowerCase(),
      password: sifre,
    });

    setBekliyor(false);

    if (error) {
      setHata(
        'E-posta veya şifre hatalı. İlk kez giriyorsanız aşağıdan giriş linki isteyin.'
      );
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function linkGonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);

    const supabase = createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email: eposta.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${site}/auth/dogrula`,
        shouldCreateUser: false, // sadece davet edilenler
      },
    });

    setBekliyor(false);

    if (error) {
      const m = error.message.toLowerCase();
      setHata(
        m.includes('signups not allowed') || m.includes('not found')
          ? 'Bu e-posta panele tanımlı değil. Büro yöneticisiyle iletişime geçin.'
          : 'Giriş linki gönderilemedi. Birkaç dakika sonra tekrar deneyin.'
      );
      return;
    }

    setLinkGonderildi(true);
  }

  return (
    <main className="giris-sarmal">
      <div className="giris-kart">
        <div className="giris-logo">
          <div className="logo-mark">AKC</div>
          <div>
            <div className="logo-ad">AKC HUKUK</div>
            <div className="logo-alt">Dosya Paneli</div>
          </div>
        </div>

        {linkGonderildi ? (
          <div className="uyari basari">
            <strong>{eposta}</strong> adresine giriş linki gönderildi.
            <br />
            <br />
            Mailinizdeki linke tıklayın; ilk girişte sizden bir şifre belirlemeniz
            istenecek. Sonraki girişlerde bu şifreyi kullanacaksınız.
            <br />
            <br />
            <span className="soluk">Link 1 saat geçerlidir.</span>
          </div>
        ) : (
          <>
            <div className="sekmeler" style={{ marginBottom: 20 }}>
              <button
                type="button"
                className={`sekme ${mod === 'sifre' ? 'aktif' : ''}`}
                onClick={() => {
                  setMod('sifre');
                  setHata(null);
                }}
              >
                Şifreyle giriş
              </button>
              <button
                type="button"
                className={`sekme ${mod === 'link' ? 'aktif' : ''}`}
                onClick={() => {
                  setMod('link');
                  setHata(null);
                }}
              >
                İlk giriş / şifremi unuttum
              </button>
            </div>

            {hata && <div className="uyari hata">{hata}</div>}

            {mod === 'sifre' ? (
              <form onSubmit={sifreyleGir}>
                <div className="alan">
                  <label htmlFor="eposta">E-posta</label>
                  <input
                    id="eposta"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="ad.soyad@akchukuk.com"
                    value={eposta}
                    onChange={(e) => setEposta(e.target.value)}
                  />
                </div>

                <div className="alan">
                  <label htmlFor="sifre">Şifre</label>
                  <input
                    id="sifre"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={sifre}
                    onChange={(e) => setSifre(e.target.value)}
                  />
                </div>

                <button className="btn genis" type="submit" disabled={bekliyor}>
                  {bekliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
                </button>
              </form>
            ) : (
              <form onSubmit={linkGonder}>
                <p className="soluk" style={{ marginTop: 0 }}>
                  Kayıtlı e-postanıza tek kullanımlık bir giriş linki gönderilir.
                  Link üzerinden girdikten sonra yeni şifrenizi belirlersiniz.
                </p>

                <div className="alan">
                  <label htmlFor="eposta-link">Kurumsal e-posta adresiniz</label>
                  <input
                    id="eposta-link"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="ad.soyad@akchukuk.com"
                    value={eposta}
                    onChange={(e) => setEposta(e.target.value)}
                  />
                </div>

                <button className="btn genis" type="submit" disabled={bekliyor}>
                  {bekliyor ? 'Gönderiliyor…' : 'Giriş linki gönder'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
