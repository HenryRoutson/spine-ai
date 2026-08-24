import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { getSupabasePublicEnv } from '@/utils/supabase/env'
import { RootInlineScripts } from '@/components/root-inline-scripts'
import { SkipLink } from '@/lib/legal/chrome'
import { CookieConsentBanner } from '@/lib/legal/cookie-consent'
import { LEGAL } from '@shared/legal/site'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// AI : read Supabase env at request time — static build would bake an empty config otherwise.
// AI : keep in sync with ROUTE_DYNAMIC in lib/server/route-config.ts.
// AI : TODO (prod) — add app/error.tsx + app/global-error.tsx and wire Sentry (or equivalent);
// AI : uncaught UI/server failures currently only hit console / Vercel logs.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: LEGAL.productName,
  description:
    'Define structured outputs, compose linear pipelines, A/B test strategies, and run validated AI inference.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabasePublic = getSupabasePublicEnv()

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <RootInlineScripts supabasePublic={supabasePublic} />
        <SkipLink />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  )
}
