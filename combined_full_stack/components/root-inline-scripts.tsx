"use client"

import { useRef } from "react"
import { useServerInsertedHTML } from "next/navigation"
import type { SupabasePublicEnv } from "@/utils/supabase/env"

type Props = {
  supabasePublic: SupabasePublicEnv | null
}

// AI : mirrors writeColorScheme() in lib/color-scheme.ts — must run before first paint.
const COLOR_SCHEME_INIT =
  `(function(){try{var s=localStorage.getItem('spine:color-scheme');if(s&&s!=='default')document.documentElement.dataset.colorScheme=s;}catch(e){}})()`

// AI : inject via useServerInsertedHTML so React 19 never sees <script> in the component tree
// AI : (raw <script> / next/script in layout both trigger the client console error).
export function RootInlineScripts({ supabasePublic }: Props) {
  const inserted = useRef(false)

  useServerInsertedHTML(() => {
    if (inserted.current) return null
    inserted.current = true

    return (
      <>
        {supabasePublic ? (
          <script
            id="supabase-public-config"
            dangerouslySetInnerHTML={{
              __html: `window.__SUPABASE_PUBLIC__=${JSON.stringify(supabasePublic)}`,
            }}
          />
        ) : null}
        <script
          id="color-scheme-init"
          dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_INIT }}
        />
      </>
    )
  })

  return null
}
