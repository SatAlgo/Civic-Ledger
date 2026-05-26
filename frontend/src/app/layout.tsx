import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Civic Ledger — A public registry for civic reports',
  description:
    'Report potholes, broken streetlights, drainage and electrical hazards. Routed to the right department, on the record.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        <div className="relative z-10">
          <AuthProvider>{children}</AuthProvider>
        </div>
        <Toaster
          position="bottom-right"
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
