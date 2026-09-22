import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = 'https://projectwarrioratlas.com';
const TITLE = 'The Warrior Atlas';
const DESCRIPTION =
  'An interactive 3D globe mapping the birthplaces and lineage of the world’s martial arts — built on Esri’s ArcGIS Maps SDK for JavaScript.';

// og:image / twitter:image and the favicons come from the file conventions next to
// this layout (opengraph-image.jpg, icon.png, apple-icon.png); metadataBase makes
// those URLs absolute, which link previews require.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: 'website', url: '/', siteName: TITLE, title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
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
