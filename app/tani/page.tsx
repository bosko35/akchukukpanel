export const dynamic = 'force-dynamic';

/**
 * GEÇİCİ TEŞHİS SAYFASI
 * Uygulamanın gerçekten hangi değerleri kullandığını ve Supabase'in
 * bu değerlere ne cevap verdiğini gösterir.
 * Sorun çözülünce bu dosyayı silin.
 */

function kirp(v: string | undefined, bas = 22) {
  if (!v) return null;
  return {
    uzunluk: v.length,
    bas: v.slice(0, bas),
    son: v.slice(-6),
    bosluk_var: v !== v.trim(),
    tirnak_var: /^["']|["']$/.test(v),
  };
}

async function testEt(url: string | undefined, anahtar: string | undefined) {
  if (!url || !anahtar) return { sonuc: 'URL veya anahtar tanımsız' };
  try {
    const cevap = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anahtar, Authorization: `Bearer ${anahtar}` },
      cache: 'no-store',
    });
    const govde = await cevap.text();
    return {
      http: cevap.status,
      cevap: govde.slice(0, 300) || '(boş — bu iyi, anahtar geçerli)',
    };
  } catch (e) {
    return { sonuc: e instanceof Error ? e.message : 'istek başarısız' };
  }
}

export default async function Tani() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const [anonTest, secretTest] = await Promise.all([
    testEt(url, anon),
    testEt(url, secret),
  ]);

  const rapor = {
    NEXT_PUBLIC_SUPABASE_URL: url ?? '(TANIMSIZ)',
    url_proje_kimligi: url ? url.replace(/^https?:\/\//, '').split('.')[0] : null,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: kirp(anon) ?? '(TANIMSIZ)',
    SUPABASE_SERVICE_ROLE_KEY: kirp(secret, 12) ?? '(TANIMSIZ)',
    SUPABASE_BUCKET: process.env.SUPABASE_BUCKET ?? '(TANIMSIZ)',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '(TANIMSIZ)',
    anon_anahtar_testi: anonTest,
    secret_anahtar_testi: secretTest,
  };

  return (
    <main style={{ padding: 24, fontFamily: 'ui-monospace, Menlo, monospace' }}>
      <h1 style={{ fontSize: 18 }}>Yapılandırma teşhisi</h1>
      <p style={{ fontSize: 13, color: '#6b7280' }}>
        Bu sayfayı sorun çözülünce silin (app/tani klasörü).
      </p>
      <pre
        style={{
          background: '#f4f5f7',
          padding: 16,
          borderRadius: 8,
          fontSize: 12.5,
          overflowX: 'auto',
        }}
      >
        {JSON.stringify(rapor, null, 2)}
      </pre>
    </main>
  );
}
