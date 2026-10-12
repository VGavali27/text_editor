import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import '@editor/ui/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Text Editor — Next.js example',
  description: 'SSR-safe React adapter rendered inside a Next.js App Router client component.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
