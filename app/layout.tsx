import type { Metadata } from 'next';
import { Geist, Geist_Mono, Newsreader } from 'next/font/google';
import { GAME_BRAND } from '@/lib/brand';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: GAME_BRAND.title,
  description: 'Prenez la tête d’un État, arbitrez ses crises et transformez un monde géopolitique vivant.',
  openGraph: {
    title: GAME_BRAND.title,
    description: `Prenez la tête d’un État. ${GAME_BRAND.tagline}.`,
    images: ['/og.png'],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: GAME_BRAND.title,
    description: `Prenez la tête d’un État. ${GAME_BRAND.tagline}.`,
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
