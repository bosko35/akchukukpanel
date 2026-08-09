'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profil } from '@/lib/types';

const MAX_BOYUT = 50 * 1024 * 1024;
const MAX_ADET = 200;

type SeciliDosya = {
  file: File;
  yol: string; // klasör içi göreli yol ("" ise tek dosya)
};

function boyutYazi(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function YuklemeKarti({
  ekip,
  benimId,
  klasorler,
}: {
  ekip: Profil[];
  benimId: string;
  klasorler: string[];
}) {
  const router = useRouter();
  const dosyaRef = useRef<HTMLInputElement>(null);
  const klasorRef = useRef<HTMLInputElement>(null);

  const digerleri = ekip.filter((p) => p.id !== benimId);

  const [alan, setAlan] = useState(''); // '' → AKC Hukuk Genel
  const [secili, setSecili] = useState<SeciliDosya[]>([]);
  const [klasor, setKlasor] = useState('Genel');
  const [aciklama, setAciklama] = useState('');
  const [gizli, setGizli] = useState(false);
  const [izinliler, setIzinliler] = useState<string[]>([]);
  const [ilerleme, setIlerleme] = useState<{ biten: number; toplam: number } | null>(null);
  const [mesaj, setMesaj] = useState<{ tip: 'hata' | 'basari'; yazi: string } | null>(null);

  // webkitdirectory React tiplerinde yok, doğrudan DOM'a yazıyoruz
  useEffect(() => {
    const el = klasorRef.current;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  function dosyalariAl(liste: FileList | null, klasorMu: boolean) {
    if (!liste || liste.length === 0) return;

    const dizi = Array.from(liste).slice(0, MAX_ADET);
    const buyuk = dizi.filter((f) => f.size > MAX_BOYUT);

    const kabul = dizi
      .filter((f) => f.size <= MAX_BOYUT)
      .map((f) => {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
        return { file: f, yol: klasorMu ? rel : '' };
      });

    setSecili(kabul);
    setMesaj(
      buyuk.length
        ? {
            tip: 'hata',
            yazi: `${buyuk.length} dosya 50 MB sınırını aştığı için listeye alınmadı.`,
          }
        : null
    );

    // Klasör seçildiyse klasör adını otomatik doldur
    if (klasorMu && kabul.length) {
      const kok = kabul[0].yol.split('/')[0];
      if (kok) setKlasor(kok);
    }
  }

  function kisiSec(id: string) {
    setIzinliler((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }

  function temizle() {
    setSecili([]);
    setAciklama('');
    setGizli(false);
    setIzinliler([]);
    if (dosyaRef.current) dosyaRef.current.value = '';
    if (klasorRef.current) klasorRef.current.value = '';
  }

  async function tekDosyaYukle(sd: SeciliDosya) {
    const linkYanit = await fetch('/api/yukleme-linki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad: sd.file.name, boyut: sd.file.size }),
    });
    const link = await linkYanit.json();
    if (!linkYanit.ok) throw new Error(link.hata || 'Yükleme linki alınamadı');

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(link.bucket)
      .uploadToSignedUrl(link.path, link.token, sd.file);
    if (error) throw new Error(`${sd.file.name}: ${error.message}`);

    const kayitYanit = await fetch('/api/dosyalar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ad: sd.file.name,
        storage_path: link.path,
        boyut: sd.file.size,
        mime: sd.file.type,
        klasor,
        yol: sd.yol || null,
        aciklama,
        alan_sahibi: alan || null,
        gizli: alan ? false : gizli,
        izinliler: !alan && gizli ? izinliler : [],
      }),
    });
    const kayit = await kayitYanit.json();
    if (!kayitYanit.ok) throw new Error(kayit.hata || 'Kayıt oluşturulamadı');
  }

  async function yukle(e: React.FormEvent) {
    e.preventDefault();
    if (!secili.length) return;

    setMesaj(null);
    setIlerleme({ biten: 0, toplam: secili.length });

    let basarili = 0;
    const hatalar: string[] = [];

    for (const sd of secili) {
      try {
        await tekDosyaYukle(sd);
        basarili++;
      } catch (err) {
        hatalar.push(err instanceof Error ? err.message : 'Bilinmeyen hata');
      }
      setIlerleme((o) => (o ? { ...o, biten: o.biten + 1 } : o));
    }

    setIlerleme(null);

    if (hatalar.length) {
      setMesaj({
        tip: 'hata',
        yazi: `${basarili} dosya yüklendi, ${hatalar.length} tanesinde hata: ${hatalar[0]}`,
      });
    } else {
      setMesaj({
        tip: 'basari',
        yazi:
          basarili === 1
            ? `"${secili[0].file.name}" yüklendi.`
            : `${basarili} dosya "${klasor}" klasörüne yüklendi.`,
      });
    }

    temizle();
    router.refresh();
  }

  const toplamBoyut = secili.reduce((t, s) => t + s.file.size, 0);
  const yukleniyor = ilerleme !== null;

  return (
    <form className="kart yan" onSubmit={yukle}>
      <div className="kart-bas">
        <h2>Dosya Yükle</h2>
      </div>

      <div className="kart-govde">
        {mesaj && <div className={`uyari ${mesaj.tip}`}>{mesaj.yazi}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className="btn ikincil kucuk"
            style={{ flex: 1 }}
            disabled={yukleniyor}
            onClick={() => dosyaRef.current?.click()}
          >
            Dosya seç
          </button>
          <button
            type="button"
            className="btn ikincil kucuk"
            style={{ flex: 1 }}
            disabled={yukleniyor}
            onClick={() => klasorRef.current?.click()}
          >
            Klasör seç
          </button>
        </div>

        <input
          ref={dosyaRef}
          type="file"
          multiple
          hidden
          onChange={(e) => dosyalariAl(e.target.files, false)}
        />
        <input
          ref={klasorRef}
          type="file"
          hidden
          onChange={(e) => dosyalariAl(e.target.files, true)}
        />

        <div
          className="birak-alani"
          onClick={() => !yukleniyor && dosyaRef.current?.click()}
        >
          {secili.length === 0 ? (
            <>
              <div className="baslik">Henüz dosya seçilmedi</div>
              <div className="alt">
                Tek tek dosya ya da bir klasörün tamamını seçebilirsiniz.
                <br />
                Dosya başına en fazla 50 MB.
              </div>
            </>
          ) : (
            <>
              <div className="baslik">
                {secili.length} dosya seçildi
              </div>
              <div className="alt">Toplam {boyutYazi(toplamBoyut)}</div>
            </>
          )}
        </div>

        {secili.length > 0 && (
          <div className="secili-liste">
            {secili.slice(0, 60).map((s, i) => (
              <div className="secili-satir" key={i}>
                <span className="yol">{s.yol || s.file.name}</span>
                <span className="soluk" style={{ flexShrink: 0 }}>
                  {boyutYazi(s.file.size)}
                </span>
              </div>
            ))}
            {secili.length > 60 && (
              <div className="secili-satir">
                <span className="soluk">
                  …ve {secili.length - 60} dosya daha
                </span>
              </div>
            )}
          </div>
        )}

        <div className="alan" style={{ marginTop: 16 }}>
          <label htmlFor="alan">Alan</label>
          <select
            id="alan"
            value={alan}
            onChange={(e) => setAlan(e.target.value)}
          >
            <option value="">AKC Hukuk — Genel (herkes görür)</option>
            {ekip.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === benimId
                  ? 'Benim alanım (sadece ben)'
                  : `${p.ad_soyad || p.eposta} — kişisel alan`}
              </option>
            ))}
          </select>
          <div className="soluk" style={{ marginTop: 5 }}>
            {alan
              ? 'Bu alandaki dosyaları yalnızca alan sahibi, yükleyen ve büro yöneticisi görür.'
              : 'Genel alandaki dosyaları panele girebilen herkes görür.'}
          </div>
        </div>

        <div className="alan">
          <label htmlFor="klasor">Klasör / Dava</label>
          <input
            id="klasor"
            type="text"
            list="klasor-listesi"
            value={klasor}
            onChange={(e) => setKlasor(e.target.value)}
            placeholder="Örn. 2026/143 Ticari Dava"
          />
          <datalist id="klasor-listesi">
            {klasorler.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>

        <div className="alan">
          <label htmlFor="aciklama">Açıklama (opsiyonel)</label>
          <input
            id="aciklama"
            type="text"
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="Kısa not"
          />
        </div>

        {!alan && (
          <div className="alan">
            <label className="onay">
              <input
                type="checkbox"
                checked={gizli}
                onChange={(e) => setGizli(e.target.checked)}
              />
              <span>
                Belirli kişilerle paylaş
                <br />
                <span className="soluk">
                  Genel alan yerine sadece seçtiğiniz kişiler görsün.
                </span>
              </span>
            </label>
          </div>
        )}

        {!alan && gizli && (
          <div className="alan">
            <label>Kimler görebilsin?</label>
            <div className="kisi-listesi">
              {digerleri.length === 0 && (
                <div className="soluk" style={{ padding: 8 }}>
                  Henüz başka kullanıcı yok.
                </div>
              )}
              {digerleri.map((p) => (
                <label className="kisi-satir" key={p.id}>
                  <input
                    type="checkbox"
                    checked={izinliler.includes(p.id)}
                    onChange={() => kisiSec(p.id)}
                  />
                  <span>
                    {p.ad_soyad || p.eposta}
                    <span className="soluk"> · {p.rol}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="soluk" style={{ marginTop: 5 }}>
              Siz ve büro yöneticisi her zaman erişebilir.
            </div>
          </div>
        )}

        {ilerleme && (
          <>
            <div className="ilerleme">
              <div
                style={{
                  width: `${(ilerleme.biten / ilerleme.toplam) * 100}%`,
                }}
              />
            </div>
            <div className="soluk" style={{ marginTop: 6, textAlign: 'center' }}>
              {ilerleme.biten} / {ilerleme.toplam} dosya yüklendi
            </div>
          </>
        )}

        <button
          className="btn genis"
          type="submit"
          disabled={yukleniyor || secili.length === 0}
          style={{ marginTop: 14 }}
        >
          {yukleniyor
            ? 'Yükleniyor…'
            : secili.length > 1
              ? `${secili.length} dosyayı yükle`
              : 'Yükle'}
        </button>

        {secili.length > 0 && !yukleniyor && (
          <button
            type="button"
            className="btn ikincil genis kucuk"
            style={{ marginTop: 8 }}
            onClick={temizle}
          >
            Seçimi temizle
          </button>
        )}
      </div>
    </form>
  );
}
