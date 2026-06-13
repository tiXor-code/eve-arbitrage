import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EVE Arbitrage — hub-to-hub hauling finder',
  description:
    'Find inter-region market arbitrage in EVE Online: buy cheap in one trade hub, fill buy orders in another. Ranked by realistic profit per trip.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
