import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ title?: string; text?: string; url?: string }>

/**
 * The Android share target (manifest `share_target`). Anything shared into
 * Descolgá lands here and goes straight into quick add, pre-filled and focused.
 * iOS/WebKit doesn't support share targets — there, capture stays "open the app".
 */
export default async function SharePage({ searchParams }: { searchParams: SearchParams }) {
  const { title, text, url } = await searchParams
  const user = await getCurrentUser()

  const draft = [title, text, url]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    // A shared link usually arrives as text + url with the url repeated; one copy is enough.
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(' ')
    .slice(0, 300)

  if (!user) redirect(`/entrar?volver=${encodeURIComponent(`/pendientes?titulo=${encodeURIComponent(draft)}`)}`)
  redirect(`/pendientes?titulo=${encodeURIComponent(draft)}`)
}
