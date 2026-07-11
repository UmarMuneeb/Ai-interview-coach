import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Interview Coach – Master your technical interviews',
  description:
    'Voice-driven AI interview coach for full-stack, system design, and agentic AI roles. Get real-time feedback and targeted Socratic tutoring.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
