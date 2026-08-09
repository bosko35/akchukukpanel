import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const HERKESE_ACIK = ['/giris', '/kayit'];

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anahtar = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Değişkenler eksikse middleware çökmesin, anlaşılır bir mesaj dönsün
  if (!supabaseUrl || !anahtar) {
    return new NextResponse(
      'Yapılandırma eksik: NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'tanımlı değil. Vercel → Settings → Environment Variables kontrol edip ' +
        'projeyi yeniden deploy edin.',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, anahtar, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Oturumu tazeler (bu satır kaldırılmamalı)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const acik = HERKESE_ACIK.some((p) => path.startsWith(p));

  // Kayıt ucu oturum gerektirmez
  if (path.startsWith('/api/kayit')) return response;

  if (!user && path.startsWith('/api/')) {
    return NextResponse.json({ hata: 'Oturum yok' }, { status: 401 });
  }

  if (!user && !acik) {
    const url = request.nextUrl.clone();
    url.pathname = '/giris';
    url.searchParams.set('yonlendir', path);
    return NextResponse.redirect(url);
  }

  if (user && acik) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Onay kontrolü sayfa/RLS seviyesinde yapılıyor (anlık olsun diye)
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
