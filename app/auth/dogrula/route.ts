import { NextResponse, type NextRequest } from 'next/server';

/**
 * Eski magic-link akışından kalan uç.
 * Sistem artık e-posta göndermiyor; gelen istekleri giriş ekranına yönlendiriyoruz.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/giris`);
}
