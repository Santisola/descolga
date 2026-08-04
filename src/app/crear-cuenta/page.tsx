import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function CrearCuentaPage() {
  if (await getCurrentUser()) redirect('/pendientes')
  return <AuthForm mode="registro" next="/pendientes" />
}
