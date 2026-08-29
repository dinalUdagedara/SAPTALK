import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

// Queries, field names and metrics are all set in mono: they are data to be
// read precisely, not prose.
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'SAPTalk',
  description:
    'Ask SAP business data questions in plain English. The model produces a validated query intent, never raw OData.',
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
