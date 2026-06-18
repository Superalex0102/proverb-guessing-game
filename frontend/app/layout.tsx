import type { Metadata } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';

import './globals.css';

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage-grotesque',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Képmutató',
  description: 'Képmutató társasjáték: Találd ki a közmondást a képek alapján!',
  icons: {
    icon: '/images/ui/landing_page/logo.svg',
    shortcut: '/images/ui/landing_page/logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className={bricolageGrotesque.className}>{children}</body>
    </html>
  );
}
