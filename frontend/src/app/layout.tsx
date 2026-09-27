import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'NeoPass | Descubrí y comprá entradas para los mejores eventos',
  description:
    'NeoPass es la ticketera definitiva para organizar y asistir a eventos con total seguridad.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="font-inter bg-neutral-950 text-neutral-50 antialiased selection:bg-indigo-500/30"
      >
        <main className="min-h-screen flex flex-col relative">
          {/* Subtle background glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="hidden md:block absolute top-0 -left-10 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px]" />
            <div className="hidden md:block absolute top-1/2 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px]" />
          </div>
          <Navbar />
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
          <BottomNav />
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#171717',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                // getApiErrorMessage separa los errores de validación con \n
                whiteSpace: 'pre-line',
              },
            }}
          />
        </main>
      </body>
    </html>
  );
}
