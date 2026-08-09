'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { DosyaSatiri, Profil } from '@/lib/types';

type Sekme = 'tumu' | 'benim' | 'gizli';

const ZIP_UYARI_SINIRI = 300 * 1024 * 1024; // 300 MB

function boyutYazi(b: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function tarihYazi(t: string) {
  return new Date(t).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function tipBilgi(ad: string): { sinif: string; etiket: string } {
  const u = ad.split('.').pop()?.toLowerCase() || '';
  if (u === 'pdf') return { sinif: 'pdf', etiket: 'PDF' };
  if (['doc', 'docx', 'odt', 'rtf'].includes(u)) return { sinif: 'doc', etiket: 'DOC' };
  if (['xls', 'xlsx', 'csv', 'ods'].includes(u)) return { sinif: 'xls', etiket: 'XLS' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'tiff'].includes(u))
    return { sinif: 'img', etiket: 'IMG' };
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'm4a'].includes(u))
    return { sinif: 'vid', etiket: 'MED' };
  return { sinif: '', etiket: (u || 'DSY').slice(0, 3).toUpperCase() };
}

/** ZIP içindeki yol: klasör + varsa alt klasör yapısı */
function zipYolu(d: DosyaSatiri) {
  const alt = d.yol ? d.yol.split('/').slice(1).join('/') : '';
  return `${d.klasor}/${alt || d.ad}`.replace(/\/{2,}/g, '/');
}

export default function DosyaListesi({
  dosyalar,
  ekip,
  benimId,
  klasorler,
}: {
  dosyalar: DosyaSatiri[];
  ekip: Profil[];
  benimId: string;
  klasorler: string[];
}) {
  const router = useRouter();
  const degistirRef = useRef<HTMLInputElement>(null);
  const hedefRef = useRef<DosyaSatiri | null>(null);

  const [sekme, setSekme] = useState<Sekme>('tumu');
  const [arama, setArama] = useState('');
  const [klasorFiltre, setKlasorFiltre] = useState('');
  const [kisiFiltre, setKisiFiltre] = useState('');
  const [alanFiltre, setAlanFiltre] = useState('');
  const [acikPaylasim, setAcikPaylasim] = useState<string | null>(null);
  const [kapaliKlasorler, setKapaliKlasorler] = useState<string[]>([]);
  const [islemde, setIslemde] = useState<string | null>(null);

  const [secili, setSecili] = useState<string[]>([]);
  const [topluDurum, setTopluDurum] = useState<string | null>(null);

  const yukleyenler = useMemo(() => {
    const idler = new Set(dosyalar.map((d) => d.sahip_id));
    return ekip.filter((p) => idler.has(p.id));
  }, [dosyalar, ekip]);

  const gosterilen = useMemo(() => {
    const q = arama.toLocaleLowerCase('tr').trim();
    return dosyalar.filter((d) => {
      if (sekme === 'benim' && d.sahip_id !== benimId) return false;
      if (sekme === 'gizli' && !d.gizli && !d.alan_sahibi) return false;
      if (alanFiltre === 'genel' && d.alan_sahibi) return false;
      if (alanFiltre && alanFiltre !== 'genel' && d.alan_sahibi !== alanFiltre)
        return false;
      if (klasorFiltre && d.klasor !== klasorFiltre) return false;
      if (kisiFiltre && d.sahip_id !== kisiFiltre) return false;
      if (!q) return true;
      return (
        d.ad.toLocaleLowerCase('tr').includes(q) ||
        d.klasor.toLocaleLowerCase('tr').includes(q) ||
        (d.yol || '').toLocaleLowerCase('tr').includes(q) ||
        (d.aciklama || '').toLocaleLowerCase('tr').includes(q) ||
        d.sahip_ad.toLocaleLowerCase('tr').includes(q) ||
        d.alan_ad.toLocaleLowerCase('tr').includes(q)
      );
    });
  }, [dosyalar, sekme, arama, klasorFiltre, kisiFiltre, alanFiltre, benimId]);

  const gruplar = useMemo(() => {
    const m = new Map<string, DosyaSatiri[]>();
    for (const d of gosterilen) {
      const mevcut = m.get(d.klasor) || [];
      mevcut.push(d);
      m.set(d.klasor, mevcut);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'tr'));
  }, [gosterilen]);

  const seciliSet = useMemo(() => new Set(secili), [secili]);
  const seciliDosyalar = useMemo(
    () => gosterilen.filter((d) => seciliSet.has(d.id)),
    [gosterilen, seciliSet]
  );
  const seciliBoyut = seciliDosyalar.reduce((t, d) => t + (d.boyut || 0), 0);
  const silinebilirSayi = seciliDosyalar.filter((d) => d.duzenleyebilir).length;
  const hepsiSecili =
    gosterilen.length > 0 && seciliDosyalar.length === gosterilen.length;

  function secimDegistir(id: string) {
    setSecili((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }

  function grupSecimi(liste: DosyaSatiri[], sec: boolean) {
    const idler = liste.map((d) => d.id);
    setSecili((o) =>
      sec ? Array.from(new Set([...o, ...idler])) : o.filter((x) => !idler.includes(x))
    );
  }

  function klasorAcKapa(k: string) {
    setKapaliKlasorler((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  }

  // ---------- Toplu indirme ----------

  async function zipIndir() {
    if (!seciliDosyalar.length) return;

    if (
      seciliBoyut > ZIP_UYARI_SINIRI &&
      !confirm(
        `Seçilen dosyalar toplam ${boyutYazi(seciliBoyut)}. ` +
          'Büyük bir arşiv tarayıcıyı zorlayabilir. Devam edilsin mi?'
      )
    )
      return;

    setTopluDurum('Linkler hazırlanıyor…');

    try {
      const yanit = await fetch('/api/indirme-linkleri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: seciliDosyalar.map((d) => d.id) }),
      });
      const j = await yanit.json();
      if (!yanit.ok) throw new Error(j.hata || 'Linkler alınamadı');

      const linkHarita = new Map<string, string>(
        (j.dosyalar as { id: string; url: string }[]).map((x) => [x.id, x.url])
      );

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const kullanilan = new Set<string>();
      let biten = 0;

      for (const d of seciliDosyalar) {
        const url = linkHarita.get(d.id);
        if (!url) continue;

        setTopluDurum(`İndiriliyor ${++biten} / ${seciliDosyalar.length}`);

        const cevap = await fetch(url);
        if (!cevap.ok) continue;
        const blob = await cevap.blob();

        let yol = zipYolu(d);
        if (kullanilan.has(yol)) {
          const nokta = yol.lastIndexOf('.');
          const govde = nokta > 0 ? yol.slice(0, nokta) : yol;
          const uzanti = nokta > 0 ? yol.slice(nokta) : '';
          let i = 2;
          while (kullanilan.has(`${govde} (${i})${uzanti}`)) i++;
          yol = `${govde} (${i})${uzanti}`;
        }
        kullanilan.add(yol);
        zip.file(yol, blob);
      }

      setTopluDurum('Arşiv oluşturuluyor…');
      const arsiv = await zip.generateAsync({ type: 'blob' });

      const bugun = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(arsiv);
      a.download = `AKC-dosyalar-${bugun}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);

      setSecili([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'İndirme başarısız');
    } finally {
      setTopluDurum(null);
    }
  }

  // ---------- Toplu silme ----------

  async function topluSil() {
    const silinecek = seciliDosyalar.filter((d) => d.duzenleyebilir);
    if (!silinecek.length) {
      alert('Seçilen dosyalar arasında silme yetkiniz olan yok.');
      return;
    }

    const atlanan = seciliDosyalar.length - silinecek.length;
    if (
      !confirm(
        `${silinecek.length} dosya kalıcı olarak silinecek.` +
          (atlanan ? `\n${atlanan} dosyada yetkiniz olmadığı için atlanacak.` : '') +
          '\n\nDevam edilsin mi?'
      )
    )
      return;

    let hata = 0;
    for (let i = 0; i < silinecek.length; i++) {
      setTopluDurum(`Siliniyor ${i + 1} / ${silinecek.length}`);
      const yanit = await fetch(`/api/dosyalar/${silinecek[i].id}`, {
        method: 'DELETE',
      });
      if (!yanit.ok) hata++;
    }

    setTopluDurum(null);
    setSecili([]);
    if (hata) alert(`${hata} dosya silinemedi.`);
    router.refresh();
  }

  // ---------- Tekil işlemler ----------

  async function sil(d: DosyaSatiri) {
    if (!confirm(`"${d.ad}" kalıcı olarak silinecek. Emin misiniz?`)) return;
    setIslemde(d.id);
    const yanit = await fetch(`/api/dosyalar/${d.id}`, { method: 'DELETE' });
    setIslemde(null);
    if (!yanit.ok) {
      const j = await yanit.json().catch(() => ({}));
      alert(j.hata || 'Silinemedi');
      return;
    }
    router.refresh();
  }

  function degistirBaslat(d: DosyaSatiri) {
    hedefRef.current = d;
    if (degistirRef.current) {
      degistirRef.current.value = '';
      degistirRef.current.click();
    }
  }

  async function degistirSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const yeni = e.target.files?.[0];
    const d = hedefRef.current;
    if (!yeni || !d) return;

    if (yeni.size > 50 * 1024 * 1024) {
      alert('Dosya 50 MB sınırını aşıyor.');
      return;
    }
    if (
      !confirm(
        `"${d.ad}" dosyasının içeriği "${yeni.name}" ile değiştirilecek.\n` +
          'Eski sürüm kalıcı olarak silinir. Devam edilsin mi?'
      )
    )
      return;

    setIslemde(d.id);
    try {
      const linkYanit = await fetch('/api/yukleme-linki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: yeni.name, boyut: yeni.size }),
      });
      const link = await linkYanit.json();
      if (!linkYanit.ok) throw new Error(link.hata || 'Yükleme linki alınamadı');

      const supabase = createClient();
      const { error } = await supabase.storage
        .from(link.bucket)
        .uploadToSignedUrl(link.path, link.token, yeni);
      if (error) throw new Error(error.message);

      const yanit = await fetch(`/api/dosyalar/${d.id}/degistir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: link.path,
          ad: yeni.name,
          boyut: yeni.size,
          mime: yeni.type,
        }),
      });
      const j = await yanit.json();
      if (!yanit.ok) throw new Error(j.hata || 'Değiştirilemedi');

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Değiştirilemedi');
    } finally {
      setIslemde(null);
      hedefRef.current = null;
    }
  }

  async function erisimKaydet(
    d: DosyaSatiri,
    gizli: boolean,
    izinliler: string[],
    alanSahibi: string | null
  ) {
    setIslemde(d.id);
    const yanit = await fetch(`/api/dosyalar/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alan_sahibi: alanSahibi,
        gizli: alanSahibi ? false : gizli,
        izinliler: !alanSahibi && gizli ? izinliler : [],
      }),
    });
    setIslemde(null);
    if (!yanit.ok) {
      const j = await yanit.json().catch(() => ({}));
      alert(j.hata || 'Kaydedilemedi');
      return;
    }
    setAcikPaylasim(null);
    router.refresh();
  }

  const filtreVar = !!(arama || klasorFiltre || kisiFiltre || alanFiltre);
  const mesgul = topluDurum !== null;

  return (
    <div className="kart">
      <input ref={degistirRef} type="file" hidden onChange={degistirSecildi} />

      <div className="kart-bas">
        <div className="sekmeler" style={{ flex: 1, maxWidth: 420 }}>
          <button
            className={`sekme ${sekme === 'tumu' ? 'aktif' : ''}`}
            onClick={() => setSekme('tumu')}
          >
            Tüm dosyalar
          </button>
          <button
            className={`sekme ${sekme === 'benim' ? 'aktif' : ''}`}
            onClick={() => setSekme('benim')}
          >
            Yüklediklerim
          </button>
          <button
            className={`sekme ${sekme === 'gizli' ? 'aktif' : ''}`}
            onClick={() => setSekme('gizli')}
          >
            Kısıtlı
          </button>
        </div>
        <span className="soluk">{gosterilen.length} dosya</span>
      </div>

      <div className="arac-cubugu">
        <input
          className="ara"
          type="text"
          placeholder="Dosya, klasör, açıklama, kişi veya alan ara…"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
        />
        <select value={alanFiltre} onChange={(e) => setAlanFiltre(e.target.value)}>
          <option value="">Tüm alanlar</option>
          <option value="genel">AKC Hukuk — Genel</option>
          {ekip.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === benimId ? 'Benim alanım' : p.ad_soyad || p.eposta}
            </option>
          ))}
        </select>
        <select value={kisiFiltre} onChange={(e) => setKisiFiltre(e.target.value)}>
          <option value="">Yükleyen: herkes</option>
          {yukleyenler.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === benimId ? 'Ben' : p.ad_soyad || p.eposta}
            </option>
          ))}
        </select>
        <select value={klasorFiltre} onChange={(e) => setKlasorFiltre(e.target.value)}>
          <option value="">Tüm klasörler</option>
          {klasorler.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {filtreVar && (
          <button
            className="btn ikincil kucuk"
            onClick={() => {
              setArama('');
              setKlasorFiltre('');
              setKisiFiltre('');
              setAlanFiltre('');
            }}
          >
            Temizle
          </button>
        )}
      </div>

      {/* Seçim çubuğu */}
      {gosterilen.length > 0 && (
        <div className={`secim-cubugu ${seciliDosyalar.length ? 'dolu' : ''}`}>
          <label className="kisi-satir" style={{ margin: 0, padding: 0 }}>
            <input
              type="checkbox"
              checked={hepsiSecili}
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    seciliDosyalar.length > 0 && !hepsiSecili;
              }}
              onChange={(e) =>
                setSecili(e.target.checked ? gosterilen.map((d) => d.id) : [])
              }
            />
            <span>
              {seciliDosyalar.length
                ? `${seciliDosyalar.length} dosya seçildi · ${boyutYazi(seciliBoyut)}`
                : 'Tümünü seç'}
            </span>
          </label>

          {seciliDosyalar.length > 0 && (
            <div className="secim-eylem">
              {topluDurum && <span className="soluk">{topluDurum}</span>}
              <button className="btn kucuk" disabled={mesgul} onClick={zipIndir}>
                ZIP indir
              </button>
              <button
                className="btn tehlike kucuk"
                disabled={mesgul || silinebilirSayi === 0}
                onClick={topluSil}
              >
                Sil{silinebilirSayi !== seciliDosyalar.length && ` (${silinebilirSayi})`}
              </button>
              <button
                className="btn ikincil kucuk"
                disabled={mesgul}
                onClick={() => setSecili([])}
              >
                Vazgeç
              </button>
            </div>
          )}
        </div>
      )}

      {gruplar.length === 0 ? (
        <div className="bos">
          <div className="ikon">◻︎</div>
          {filtreVar
            ? 'Bu filtrelere uyan dosya yok.'
            : sekme === 'benim'
              ? 'Henüz dosya yüklemediniz.'
              : sekme === 'gizli'
                ? 'Kısıtlı erişimli dosya yok.'
                : 'Henüz dosya yok. Soldaki formdan ilk dosyayı yükleyin.'}
        </div>
      ) : (
        gruplar.map(([klasorAdi, liste]) => {
          const kapali = kapaliKlasorler.includes(klasorAdi);
          const grupSecili = liste.every((d) => seciliSet.has(d.id));
          const grupKismi = !grupSecili && liste.some((d) => seciliSet.has(d.id));

          return (
            <div className="klasor-grup" key={klasorAdi}>
              <div className="klasor-bas">
                <input
                  type="checkbox"
                  checked={grupSecili}
                  ref={(el) => {
                    if (el) el.indeterminate = grupKismi;
                  }}
                  onChange={(e) => grupSecimi(liste, e.target.checked)}
                  title="Bu klasördeki tüm dosyaları seç"
                />
                <button
                  className="klasor-ad"
                  onClick={() => klasorAcKapa(klasorAdi)}
                >
                  <span className="ok">{kapali ? '▶' : '▼'}</span>
                  {klasorAdi}
                  <span className="adet">{liste.length}</span>
                </button>
              </div>

              {!kapali &&
                liste.map((d) => {
                  const tip = tipBilgi(d.ad);
                  const altYol = d.yol ? d.yol.split('/').slice(1, -1).join(' / ') : '';
                  return (
                    <div key={d.id}>
                      <div
                        className={`dosya-satir ${seciliSet.has(d.id) ? 'secili' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={seciliSet.has(d.id)}
                          onChange={() => secimDegistir(d.id)}
                        />

                        <div className={`tip-rozet ${tip.sinif}`}>{tip.etiket}</div>

                        <div className="dosya-orta">
                          <div className="dosya-ad">
                            {d.ad}
                            {d.alan_sahibi ? (
                              <span className="rozet alan">{d.alan_ad}</span>
                            ) : d.gizli ? (
                              <span className="rozet gizli">Kısıtlı</span>
                            ) : null}
                            {d.sahip_id === benimId && (
                              <span className="rozet benim">Ben</span>
                            )}
                          </div>
                          <div className="dosya-meta">
                            {altYol && <span>{altYol} ·</span>}
                            <span>{d.sahip_ad}</span>
                            <span>· {tarihYazi(d.created_at)}</span>
                            {d.boyut ? <span>· {boyutYazi(d.boyut)}</span> : null}
                            {d.guncelleme_at && (
                              <span>· {tarihYazi(d.guncelleme_at)} güncellendi</span>
                            )}
                            {d.aciklama && <span>· {d.aciklama}</span>}
                          </div>
                        </div>

                        <div className="eylemler">
                          <a className="btn kucuk" href={`/api/indir/${d.id}`}>
                            İndir
                          </a>
                          {d.duzenleyebilir && (
                            <>
                              <button
                                className="btn ikincil kucuk"
                                disabled={islemde === d.id}
                                onClick={() => degistirBaslat(d)}
                              >
                                {islemde === d.id ? 'Yükleniyor…' : 'Değiştir'}
                              </button>
                              <button
                                className="btn ikincil kucuk"
                                onClick={() =>
                                  setAcikPaylasim(acikPaylasim === d.id ? null : d.id)
                                }
                              >
                                Erişim
                              </button>
                              <button
                                className="btn tehlike kucuk"
                                disabled={islemde === d.id}
                                onClick={() => sil(d)}
                              >
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {acikPaylasim === d.id && (
                        <ErisimDuzenle
                          dosya={d}
                          ekip={ekip}
                          benimId={benimId}
                          kaydediliyor={islemde === d.id}
                          onKaydet={(gizli, izinliler, alanSahibi) =>
                            erisimKaydet(d, gizli, izinliler, alanSahibi)
                          }
                          onIptal={() => setAcikPaylasim(null)}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })
      )}
    </div>
  );
}

function ErisimDuzenle({
  dosya,
  ekip,
  benimId,
  kaydediliyor,
  onKaydet,
  onIptal,
}: {
  dosya: DosyaSatiri;
  ekip: Profil[];
  benimId: string;
  kaydediliyor: boolean;
  onKaydet: (gizli: boolean, izinliler: string[], alanSahibi: string | null) => void;
  onIptal: () => void;
}) {
  const [alan, setAlan] = useState(dosya.alan_sahibi || '');
  const [gizli, setGizli] = useState(dosya.gizli);
  const [izinliler, setIzinliler] = useState<string[]>(dosya.izinliler);

  const secilebilir = ekip.filter((p) => p.id !== dosya.sahip_id);

  return (
    <div className="erisim-panel">
      <div className="alan" style={{ maxWidth: 380 }}>
        <label htmlFor={`alan-${dosya.id}`}>Alan</label>
        <select
          id={`alan-${dosya.id}`}
          value={alan}
          onChange={(e) => setAlan(e.target.value)}
        >
          <option value="">AKC Hukuk — Genel</option>
          {ekip.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === benimId
                ? 'Benim alanım'
                : `${p.ad_soyad || p.eposta} — kişisel alan`}
            </option>
          ))}
        </select>
      </div>

      {!alan && (
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
              Kapalıysa panele girebilen herkes bu dosyayı görür.
            </span>
          </span>
        </label>
      )}

      {!alan && gizli && (
        <div className="kisi-listesi" style={{ marginTop: 10, maxWidth: 380 }}>
          {secilebilir.length === 0 && (
            <div className="soluk" style={{ padding: 8 }}>
              Paylaşılacak başka kullanıcı yok.
            </div>
          )}
          {secilebilir.map((p) => (
            <label className="kisi-satir" key={p.id}>
              <input
                type="checkbox"
                checked={izinliler.includes(p.id)}
                onChange={() =>
                  setIzinliler((o) =>
                    o.includes(p.id) ? o.filter((x) => x !== p.id) : [...o, p.id]
                  )
                }
              />
              <span>
                {p.ad_soyad || p.eposta}
                <span className="soluk"> · {p.rol}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn kucuk"
          disabled={kaydediliyor}
          onClick={() => onKaydet(gizli, izinliler, alan || null)}
        >
          {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button className="btn ikincil kucuk" onClick={onIptal}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}
