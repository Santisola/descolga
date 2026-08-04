import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>
}) {
  if (await getCurrentUser()) redirect('/pendientes')
  const { volver } = await searchParams
  // Only same-origin paths, so a crafted ?volver= can't bounce the user off-site.
  const next = volver?.startsWith('/') ? volver : '/pendientes'
  return <AuthForm mode="entrar" next={next} />
}
