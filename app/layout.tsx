import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ORDO — Simulation géopolitique',
  description: 'Prototype de grande stratégie conversationnelle assistée par IA.',
  openGraph: {
    title: 'ORDO — Simulation géopolitique',
    description: 'Négociez, arbitrez et transformez un monde simulé.',
    images: ['/og.png'],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ORDO — Simulation géopolitique',
    description: 'Négociez, arbitrez et transformez un monde simulé.',
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
