'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function GirisSayfasi() {
  const router = useRouter();
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function gir(e: React.FormEvent) {
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
      console.error('[giris] hata:', error);
      const m = error.message.toLowerCase();

      if (m.includes('invalid login credentials')) {
        setHata('E-posta veya şifre hatalı.');
      } else if (m.includes('email not confirmed')) {
        setHata(
          'E-posta doğrulanmamış. Supabase → Authentication → Providers → Email → ' +
            '"Confirm email" ayarını kapatın.'
        );
      } else {
        // Yapılandırma hataları (geçersiz anahtar vb.) burada görünsün
        setHata(`Giriş yapılamadı: ${error.message}`);
      }
      return;
    }

    router.push('/');
    router.refresh();
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

        {hata && <div className="uyari hata">{hata}</div>}

        <form onSubmit={gir}>
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

        <p className="soluk" style={{ marginTop: 18, marginBottom: 0 }}>
          Hesabınız yok mu? <Link href="/kayit">Kayıt olun</Link> — kaydınız büro
          yöneticisinin onayından sonra aktifleşir.
        </p>
        <p className="soluk" style={{ marginTop: 8, marginBottom: 0 }}>
          Şifrenizi unuttuysanız büro yöneticisi sizin için yeni bir şifre
          belirleyebilir.
        </p>
      </div>
    </main>
  );
}
