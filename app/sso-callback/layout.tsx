import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Signing in',
  robots: { index: false, follow: false },
}

export default function SsoCallbackLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
