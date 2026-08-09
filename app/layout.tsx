import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AKC Hukuk — Dosya Paneli',
  description: 'AKC Hukuk Bürosu iç dosya paylaşım paneli',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
