import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { yoneticiMi } from '@/lib/yetki';

/** Yönetici doğrudan hesap açar (onaylı olarak). */
export async function POST(request: Request) {
  const yid = await yoneticiMi();
  if (!yid) {
    return NextResponse.json({ hata: 'Yetkiniz yok' }, { status: 403 });
  }

  const { eposta, sifre, ad_soyad, rol } = (await request.json()) as {
    eposta?: string;
    sifre?: string;
    ad_soyad?: string;
    rol?: string;
  };

  const mail = eposta?.trim().toLowerCase();
  if (!mail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return NextResponse.json({ hata: 'Geçerli bir e-posta girin.' }, { status: 400 });
  }
  if (!sifre || sifre.length < 8) {
    return NextResponse.json({ hata: 'Şifre en az 8 karakter olmalı.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: mail,
    password: sifre,
    email_confirm: true,
    user_metadata: { ad_soyad: ad_soyad?.trim() || null, sifre_belirlendi: true },
  });

  if (error || !data.user) {
    const m = (error?.message || '').toLowerCase();
    return NextResponse.json(
      {
        hata:
          m.includes('already') || m.includes('registered')
            ? 'Bu e-posta ile zaten bir hesap var.'
            : 'Hesap oluşturulamadı.',
      },
      { status: 400 }
    );
  }

  await admin
    .from('profiller')
    .update({
      ad_soyad: ad_soyad?.trim() || null,
      rol: ['yonetici', 'avukat', 'stajyer'].includes(rol || '') ? rol : 'stajyer',
      onay_durumu: 'onayli',
      aktif: true,
    })
    .eq('id', data.user.id);

  return NextResponse.json({ tamam: true });
}
