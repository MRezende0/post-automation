import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cockpit — post-automation',
  description: 'Aprovar, escolher legenda/arte e agendar posts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
