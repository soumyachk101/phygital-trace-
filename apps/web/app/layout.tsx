import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/app/components/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Phygital-Trace | Proof-of-Reality Verification',
  description: 'Cryptographic proof that your photos are real. Camera-to-blockchain verification for citizen journalism.',
  keywords: ['verification', 'blockchain', 'photography', 'proof', 'authenticity'],
  openGraph: {
    title: 'Phygital-Trace',
    description: 'Verify photos on the blockchain',
    type: 'website',
    siteName: 'Phygital-Trace'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}

import Link from 'next/link';

function Header() {
  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">Phygital-Trace</span>
        </Link>

        <nav className="flex items-center space-x-6">
          <Link
            href="/verify"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Verify
          </Link>
          <a
            href="#how-it-works"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            How It Works
          </a>
          <a
            href="#demo"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Demo
          </a>
          <Link
            href="/verify"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} Phygital-Trace. Open Source.
          </p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">
              Documentation
            </Link>
            <a
              href="https://github.com/phygital-trace"
              className="text-sm text-gray-600 hover:text-gray-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="/verify"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Verify Certificate
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
