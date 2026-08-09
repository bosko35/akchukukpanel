'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function KayitSayfasi() {
  const [adSoyad, setAdSoyad] = useState('');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifre2, setSifre2] = useState('');
  const [bekliyor, setBekliyor] = useState(false);
  const [tamam, setTamam] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function gonder(e: React.FormEvent) {
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
    const yanit = await fetch('/api/kayit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eposta, sifre, ad_soyad: adSoyad }),
    });
    const j = await yanit.json().catch(() => ({}));
    setBekliyor(false);

    if (!yanit.ok) {
      setHata(j.hata || 'Kayıt oluşturulamadı.');
      return;
    }
    setTamam(true);
  }

  return (
    <main className="giris-sarmal">
      <div className="giris-kart">
        <div className="giris-logo">
          <div className="logo-mark">AKC</div>
          <div>
            <div className="logo-ad">AKC HUKUK</div>
            <div className="logo-alt">Hesap oluştur</div>
          </div>
        </div>

        {tamam ? (
          <>
            <div className="uyari basari">
              Kaydınız alındı.
              <br />
              <br />
              Hesabınız büro yöneticisinin onayından sonra aktifleşecek. Onay
              verildiğinde belirlediğiniz e-posta ve şifreyle giriş yapabilirsiniz.
            </div>
            <Link href="/giris" className="btn genis">
              Giriş ekranına dön
            </Link>
          </>
        ) : (
          <form onSubmit={gonder}>
            {hata && <div className="uyari hata">{hata}</div>}

            <div className="alan">
              <label htmlFor="ad">Ad Soyad</label>
              <input
                id="ad"
                type="text"
                required
                placeholder="Av. Ad Soyad"
                value={adSoyad}
                onChange={(e) => setAdSoyad(e.target.value)}
              />
            </div>

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
              <label htmlFor="s1">Şifre</label>
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
              <label htmlFor="s2">Şifre (tekrar)</label>
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
              {bekliyor ? 'Gönderiliyor…' : 'Kayıt ol'}
            </button>

            <p className="soluk" style={{ marginTop: 14, marginBottom: 0 }}>
              Kaydınız yönetici onayından sonra aktifleşir.{' '}
              <Link href="/giris">Zaten hesabım var</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
