'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ONAY_ETIKET, ROL_ETIKET, type Profil, type Rol } from '@/lib/types';

function tarihYazi(t: string) {
  return new Date(t).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Okunması kolay geçici şifre üretir. */
function sifreUret() {
  const harfler = 'abcdefghijkmnpqrstuvwxyz';
  const buyuk = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rakam = '23456789';
  const sec = (k: string, n: number) =>
    Array.from({ length: n }, () => k[Math.floor(Math.random() * k.length)]).join('');
  return `${sec(buyuk, 1)}${sec(harfler, 5)}-${sec(rakam, 4)}`;
}

export default function KullaniciYonetimi({
  kullanicilar,
  benimId,
}: {
  kullanicilar: Profil[];
  benimId: string;
}) {
  const router = useRouter();
  const [islemde, setIslemde] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<{ tip: 'hata' | 'basari'; yazi: string } | null>(
    null
  );
  const [formAcik, setFormAcik] = useState(false);

  // Yeni hesap formu
  const [yeniAd, setYeniAd] = useState('');
  const [yeniMail, setYeniMail] = useState('');
  const [yeniSifre, setYeniSifre] = useState(sifreUret());
  const [yeniRol, setYeniRol] = useState<Rol>('stajyer');

  async function guncelle(id: string, govde: Record<string, unknown>, bilgi?: string) {
    setIslemde(id);
    setMesaj(null);
    const yanit = await fetch(`/api/kullanicilar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    const j = await yanit.json().catch(() => ({}));
    setIslemde(null);

    if (!yanit.ok) {
      setMesaj({ tip: 'hata', yazi: j.hata || 'İşlem başarısız.' });
      return;
    }
    if (bilgi) setMesaj({ tip: 'basari', yazi: bilgi });
    router.refresh();
  }

  async function sifreSifirla(k: Profil) {
    const yeni = sifreUret();
    if (
      !confirm(
        `${k.ad_soyad || k.eposta} için yeni şifre:\n\n${yeni}\n\n` +
          'Bu şifreyi kullanıcıya kendiniz iletmelisiniz. Devam edilsin mi?'
      )
    )
      return;

    await guncelle(
      k.id,
      { yeni_sifre: yeni },
      `Yeni şifre: ${yeni} — bu şifreyi ${k.ad_soyad || k.eposta} kişisine iletin.`
    );
  }

  async function hesapSil(k: Profil) {
    if (
      !confirm(
        `${k.ad_soyad || k.eposta} hesabı ve yüklediği tüm dosyalar kalıcı olarak silinecek.\n\nEmin misiniz?`
      )
    )
      return;

    setIslemde(k.id);
    const yanit = await fetch(`/api/kullanicilar/${k.id}`, { method: 'DELETE' });
    const j = await yanit.json().catch(() => ({}));
    setIslemde(null);

    if (!yanit.ok) {
      setMesaj({ tip: 'hata', yazi: j.hata || 'Silinemedi.' });
      return;
    }
    router.refresh();
  }

  async function hesapAc(e: React.FormEvent) {
    e.preventDefault();
    setMesaj(null);
    setIslemde('yeni');

    const yanit = await fetch('/api/kullanicilar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ad_soyad: yeniAd,
        eposta: yeniMail,
        sifre: yeniSifre,
        rol: yeniRol,
      }),
    });
    const j = await yanit.json().catch(() => ({}));
    setIslemde(null);

    if (!yanit.ok) {
      setMesaj({ tip: 'hata', yazi: j.hata || 'Hesap açılamadı.' });
      return;
    }

    setMesaj({
      tip: 'basari',
      yazi: `${yeniMail} hesabı açıldı. Şifre: ${yeniSifre} — kullanıcıya iletin.`,
    });
    setYeniAd('');
    setYeniMail('');
    setYeniSifre(sifreUret());
    setFormAcik(false);
    router.refresh();
  }

  const bekleyenler = kullanicilar.filter((k) => k.onay_durumu === 'bekliyor');
  const digerleri = kullanicilar.filter((k) => k.onay_durumu !== 'bekliyor');

  return (
    <>
      {mesaj && <div className={`uyari ${mesaj.tip}`}>{mesaj.yazi}</div>}

      <div className="kart" style={{ marginBottom: 20 }}>
        <div className="kart-bas">
          <h2>Yeni hesap aç</h2>
          <button
            className="btn ikincil kucuk"
            onClick={() => setFormAcik((o) => !o)}
          >
            {formAcik ? 'Kapat' : 'Hesap aç'}
          </button>
        </div>

        {formAcik && (
          <form className="kart-govde" onSubmit={hesapAc}>
            <div className="form-satir">
              <div className="alan">
                <label htmlFor="yad">Ad Soyad</label>
                <input
                  id="yad"
                  type="text"
                  required
                  value={yeniAd}
                  onChange={(e) => setYeniAd(e.target.value)}
                  placeholder="Av. Ad Soyad"
                />
              </div>
              <div className="alan">
                <label htmlFor="ymail">E-posta</label>
                <input
                  id="ymail"
                  type="email"
                  required
                  value={yeniMail}
                  onChange={(e) => setYeniMail(e.target.value)}
                  placeholder="ad.soyad@akchukuk.com"
                />
              </div>
            </div>

            <div className="form-satir">
              <div className="alan">
                <label htmlFor="ysifre">Geçici şifre</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="ysifre"
                    type="text"
                    required
                    value={yeniSifre}
                    onChange={(e) => setYeniSifre(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn ikincil kucuk"
                    onClick={() => setYeniSifre(sifreUret())}
                  >
                    Yenile
                  </button>
                </div>
              </div>
              <div className="alan">
                <label htmlFor="yrol">Rol</label>
                <select
                  id="yrol"
                  value={yeniRol}
                  onChange={(e) => setYeniRol(e.target.value as Rol)}
                >
                  <option value="stajyer">Stajyer</option>
                  <option value="avukat">Avukat</option>
                  <option value="yonetici">Yönetici</option>
                </select>
              </div>
            </div>

            <button className="btn" type="submit" disabled={islemde === 'yeni'}>
              {islemde === 'yeni' ? 'Açılıyor…' : 'Hesabı aç'}
            </button>
            <div className="soluk" style={{ marginTop: 8 }}>
              Hesap doğrudan onaylı açılır. Şifreyi kullanıcıya siz iletirsiniz;
              hiçbir mail gönderilmez.
            </div>
          </form>
        )}
      </div>

      {bekleyenler.length > 0 && (
        <div className="kart" style={{ marginBottom: 20 }}>
          <div className="kart-bas">
            <h2>Onay bekleyenler</h2>
            <span className="soluk">{bekleyenler.length} kişi</span>
          </div>
          {bekleyenler.map((k) => (
            <div className="dosya-satir" key={k.id}>
              <div className="dosya-orta">
                <div className="dosya-ad">{k.ad_soyad || '—'}</div>
                <div className="dosya-meta">
                  <span>{k.eposta}</span>
                  <span>· {tarihYazi(k.created_at)} kaydoldu</span>
                </div>
              </div>
              <div className="eylemler">
                <select
                  defaultValue="stajyer"
                  onChange={(e) => guncelle(k.id, { rol: e.target.value })}
                  style={{ width: 'auto', minWidth: 120 }}
                >
                  <option value="stajyer">Stajyer</option>
                  <option value="avukat">Avukat</option>
                  <option value="yonetici">Yönetici</option>
                </select>
                <button
                  className="btn kucuk"
                  disabled={islemde === k.id}
                  onClick={() =>
                    guncelle(
                      k.id,
                      { onay_durumu: 'onayli', aktif: true },
                      `${k.eposta} onaylandı.`
                    )
                  }
                >
                  Onayla
                </button>
                <button
                  className="btn tehlike kucuk"
                  disabled={islemde === k.id}
                  onClick={() => guncelle(k.id, { onay_durumu: 'reddedildi' })}
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="kart">
        <div className="kart-bas">
          <h2>Kullanıcılar</h2>
          <span className="soluk">{digerleri.length} kayıt</span>
        </div>

        {digerleri.length === 0 ? (
          <div className="bos">Henüz onaylı kullanıcı yok.</div>
        ) : (
          digerleri.map((k) => {
            const pasif = !k.aktif || k.onay_durumu === 'reddedildi';
            return (
              <div className="dosya-satir" key={k.id}>
                <div className="dosya-orta">
                  <div className="dosya-ad">
                    {k.ad_soyad || '—'}
                    {k.id === benimId && <span className="rozet benim">Ben</span>}
                    {pasif && <span className="rozet gizli">{ONAY_ETIKET[k.onay_durumu]}</span>}
                  </div>
                  <div className="dosya-meta">
                    <span>{k.eposta}</span>
                    <span>· {ROL_ETIKET[k.rol]}</span>
                    <span>· {tarihYazi(k.created_at)}</span>
                  </div>
                </div>

                <div className="eylemler">
                  <select
                    value={k.rol}
                    disabled={k.id === benimId || islemde === k.id}
                    onChange={(e) => guncelle(k.id, { rol: e.target.value })}
                    style={{ width: 'auto', minWidth: 120 }}
                  >
                    <option value="stajyer">Stajyer</option>
                    <option value="avukat">Avukat</option>
                    <option value="yonetici">Yönetici</option>
                  </select>

                  <button
                    className="btn ikincil kucuk"
                    disabled={islemde === k.id}
                    onClick={() => sifreSifirla(k)}
                  >
                    Şifre sıfırla
                  </button>

                  {k.id !== benimId &&
                    (pasif ? (
                      <button
                        className="btn kucuk"
                        disabled={islemde === k.id}
                        onClick={() =>
                          guncelle(k.id, { onay_durumu: 'onayli', aktif: true })
                        }
                      >
                        Erişimi aç
                      </button>
                    ) : (
                      <button
                        className="btn ikincil kucuk"
                        disabled={islemde === k.id}
                        onClick={() => guncelle(k.id, { aktif: false })}
                      >
                        Erişimi kapat
                      </button>
                    ))}

                  {k.id !== benimId && (
                    <button
                      className="btn tehlike kucuk"
                      disabled={islemde === k.id}
                      onClick={() => hesapSil(k)}
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
