import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Warrior Atlas',
  description:
    'An interactive 3D globe mapping the birthplaces and lineage of the world’s martial arts — built on Esri’s ArcGIS Maps SDK for JavaScript.',
};

export const viewport: Viewport = {
  themeColor: '#0B0706',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
