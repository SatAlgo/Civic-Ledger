import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';

export const metadata: Metadata = {
  title: 'Civic Ledger — A public registry for civic reports',
  description:
    'Report potholes, broken streetlights, drainage and electrical hazards. Routed to the right department, on the record.',
};

export const viewport: Viewport = {
  themeColor: '#f5f1e8',
  width: 'device-width',
  initialScale: 1,
  // Allow the user to zoom (a11y) but don't auto-scale on input focus
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        <div className="relative z-10">
          <AuthProvider>
            <Navbar />
            {children}
            <MobileBottomNav />
          </AuthProvider>
        </div>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#0a0a0a',
              color: '#f5f1e8',
              borderRadius: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              border: '1px solid #b8442e',
            },
          }}
        />
      </body>
    </html>
  );
}
