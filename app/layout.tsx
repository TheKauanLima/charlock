import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import GoogleAnalytics from '@/components/google-analytics/GoogleAnalytics'
import GlobalNav from '@/components/GlobalNav/GlobalNav'
import { SHARED_OPEN_GRAPH, SHARED_TWITTER, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME } from '@/lib/site-metadata'
import { getSiteUrl } from '@/lib/site-url'
import './globals.css'
import '@/components/styles/CitadelBaseStyles.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// openGraph and twitter intentionally omit title/description: Next fills them from
// each page's resolved title and description (postProcessMetadata). Pages must not
// set openGraph or twitter, because a child object replaces this one entirely.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  openGraph: {
    ...SHARED_OPEN_GRAPH,
  },
  twitter: {
    ...SHARED_TWITTER,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-black antialiased`}>
        <ClerkProvider>
          <GlobalNav />
          {children}
        </ClerkProvider>
        <GoogleAnalytics />
      </body>
    </html>
  )
}
