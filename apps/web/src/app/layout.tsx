import type { Metadata, Viewport } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BRAND, SITE_URL, TAGLINE } from '@/lib/og';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

// Queries, field names and metrics are all set in mono: they are data to be
// read precisely, not prose.
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  // Relative image and canonical URLs resolve against this, so Open Graph
  // crawlers get absolute ones. Without it they silently get nothing.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SAPTalk — natural language to OData',
    // Any future page sets only its own name.
    template: '%s · SAPTalk',
  },
  description: TAGLINE,
  applicationName: 'SAPTalk',
  authors: [{ name: 'Dinal Udagedara', url: 'https://dinaludagedara.com' }],
  creator: 'Dinal Udagedara',
  keywords: [
    'SAP',
    'OData',
    'S/4HANA',
    'natural language query',
    'LLM',
    'structured outputs',
    'NestJS',
    'Next.js',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'SAPTalk',
    title: 'SAPTalk — natural language to OData',
    description: TAGLINE,
    locale: 'en_GB',
    // The image itself comes from app/opengraph-image.tsx; Next wires it up.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SAPTalk — natural language to OData',
    description: TAGLINE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  // The page commits to dark, so the browser chrome should too.
  colorScheme: 'dark',
  themeColor: BRAND.ground,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The design commits to dark; `dark` is set rather than left to the OS so
    // shadcn's dark variants resolve consistently.
    <html lang="en" className={cn('dark', geist.variable, mono.variable)}>
      <body className="min-h-screen font-sans">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
