import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { getSupabasePublicEnv } from '@/utils/supabase/env'
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
      <head>
        {/* AI : next/script with beforeInteractive avoids the React 19 warning about raw <script> tags in components */}
        {supabasePublic ? (
          <Script
            id="supabase-public-config"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.__SUPABASE_PUBLIC__=${JSON.stringify(supabasePublic)}`,
            }}
          />
        ) : null}
        {/* AI : apply saved color scheme before first paint — mirrors writeColorScheme() in lib/color-scheme.ts */}
        <Script
          id="color-scheme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('spine:color-scheme');if(s&&s!=='default')document.documentElement.dataset.colorScheme=s;}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <SkipLink />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  )
}
