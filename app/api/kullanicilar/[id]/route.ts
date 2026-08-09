import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { yoneticiMi } from '@/lib/yetki';

type Ctx = { params: Promise<{ id: string }> };

const ROLLER = ['yonetici', 'avukat', 'stajyer'];
const DURUMLAR = ['bekliyor', 'onayli', 'reddedildi'];

/** Onaylama, rol değiştirme, şifre sıfırlama, hesabı açma/kapatma. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const yid = await yoneticiMi();
  if (!yid) return NextResponse.json({ hata: 'Yetkiniz yok' }, { status: 403 });

  const { onay_durumu, rol, aktif, yeni_sifre, ad_soyad } =
    (await request.json()) as {
      onay_durumu?: string;
      rol?: string;
      aktif?: boolean;
      yeni_sifre?: string;
      ad_soyad?: string;
    };

  // Yönetici kendi yetkisini kazara düşürmesin
  if (id === yid && (rol && rol !== 'yonetici')) {
    return NextResponse.json(
      { hata: 'Kendi yönetici yetkinizi kaldıramazsınız.' },
      { status: 400 }
    );
  }
  if (id === yid && (aktif === false || onay_durumu === 'reddedildi')) {
    return NextResponse.json(
      { hata: 'Kendi hesabınızı kapatamazsınız.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  if (yeni_sifre) {
    if (yeni_sifre.length < 8) {
      return NextResponse.json(
        { hata: 'Şifre en az 8 karakter olmalı.' },
        { status: 400 }
      );
    }
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: yeni_sifre,
    });
    if (error) {
      return NextResponse.json({ hata: 'Şifre değiştirilemedi.' }, { status: 400 });
    }
  }

  const guncelleme: Record<string, unknown> = {};
  if (onay_durumu && DURUMLAR.includes(onay_durumu))
    guncelleme.onay_durumu = onay_durumu;
  if (rol && ROLLER.includes(rol)) guncelleme.rol = rol;
  if (typeof aktif === 'boolean') guncelleme.aktif = aktif;
  if (typeof ad_soyad === 'string') guncelleme.ad_soyad = ad_soyad.trim() || null;

  if (Object.keys(guncelleme).length) {
    const { error } = await admin.from('profiller').update(guncelleme).eq('id', id);
    if (error) {
      return NextResponse.json({ hata: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ tamam: true });
}

/** Hesabı tamamen siler. Yüklediği dosyalar da silinir (cascade). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const yid = await yoneticiMi();
  if (!yid) return NextResponse.json({ hata: 'Yetkiniz yok' }, { status: 403 });

  if (id === yid) {
    return NextResponse.json(
      { hata: 'Kendi hesabınızı silemezsiniz.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ hata: 'Hesap silinemedi.' }, { status: 400 });
  }

  return NextResponse.json({ tamam: true });
}
