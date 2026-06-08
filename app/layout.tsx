import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: 'VARkings - Quiniela Mundial 2026',
  description: 'Compite con tus amigos en la quiniela más vikinga del Mundial 2026',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VARkings',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'VARkings - Quiniela Mundial 2026',
    description: 'Compite con tus amigos en la quiniela más vikinga del Mundial 2026',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2D6A4F',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce is injected by middleware per-request for CSP enforcement
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="es" className={geist.variable}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Capture beforeinstallprompt before React hydrates to avoid race condition */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: `
            window.addEventListener('beforeinstallprompt', function(e) {
              e.preventDefault();
              window.__pwaPrompt = e;
            });
          `}}
        />
      </head>
      <body className="antialiased bg-surface min-h-screen">{children}</body>
    </html>
  );
}
