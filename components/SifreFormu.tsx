'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SifreFormu() {
  const router = useRouter();
  const params = useSearchParams();
  const yenileme = params.get('yenile') === '1';

  const [adSoyad, setAdSoyad] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifre2, setSifre2] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    if (sifre.length < 8) {
      setHata('Şifre en az 8 karakter olmalı.');
      return;
    }
    if (sifre !== sifre2) {
      setHata('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setBekliyor(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.updateUser({
      password: sifre,
      data: { sifre_belirlendi: true },
    });

    if (error || !data.user) {
      setBekliyor(false);
      setHata(
        error?.message.toLowerCase().includes('different')
          ? 'Yeni şifre eskisiyle aynı olamaz.'
          : 'Şifre kaydedilemedi. Sayfayı yenileyip tekrar deneyin.'
      );
      return;
    }

    const guncelleme: Record<string, unknown> = { sifre_belirlendi: true };
    if (adSoyad.trim()) guncelleme.ad_soyad = adSoyad.trim();
    await supabase.from('profiller').update(guncelleme).eq('id', data.user.id);

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
            <div className="logo-alt">
              {yenileme ? 'Yeni şifre belirleyin' : 'Hesabınızı tamamlayın'}
            </div>
          </div>
        </div>

        <p className="soluk" style={{ marginTop: 0 }}>
          {yenileme
            ? 'Yeni şifrenizi belirleyin. Bundan sonraki girişlerde bunu kullanacaksınız.'
            : 'Bundan sonraki girişlerinizde kullanacağınız şifreyi belirleyin.'}
        </p>

        {hata && <div className="uyari hata">{hata}</div>}

        <form onSubmit={kaydet}>
          {!yenileme && (
            <div className="alan">
              <label htmlFor="ad">Ad Soyad</label>
              <input
                id="ad"
                type="text"
                placeholder="Av. Ad Soyad"
                value={adSoyad}
                onChange={(e) => setAdSoyad(e.target.value)}
              />
            </div>
          )}

          <div className="alan">
            <label htmlFor="s1">Yeni şifre</label>
            <input
              id="s1"
              type="password"
              required
              autoComplete="new-password"
              placeholder="En az 8 karakter"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
            />
          </div>

          <div className="alan">
            <label htmlFor="s2">Yeni şifre (tekrar)</label>
            <input
              id="s2"
              type="password"
              required
              autoComplete="new-password"
              value={sifre2}
              onChange={(e) => setSifre2(e.target.value)}
            />
          </div>

          <button className="btn genis" type="submit" disabled={bekliyor}>
            {bekliyor ? 'Kaydediliyor…' : 'Şifreyi kaydet ve panele gir'}
          </button>
        </form>
      </div>
    </main>
  );
}
