import './globals.css';
import type { Metadata, Viewport } from 'next';
import { getLang } from '@/lib/i18n';
export const metadata: Metadata = { title: 'SmartFace HR', description: 'Face attendance and HR management' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang={getLang()}><body>{children}</body></html>;
}
