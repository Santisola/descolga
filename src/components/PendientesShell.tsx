'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { pushState, type PushState } from '@/lib/push-client'
import { BellOffIcon, GearIcon, PlusIcon, ShareIcon } from './icons'
import { NewReminderSheet } from './NewReminderSheet'
import { PermissionSheet } from './PermissionSheet'
import { QuickAdd } from './QuickAdd'

type Props = {
  kicker: string
  title: string
  insistHint: string
  cadenceLine: string
  quietLine: string
  vapidPublicKey: string
  /** True once there is something worth notifying about (design 1g's trigger). */
  hasReminders: boolean
  /** ?nuevo=1 from the manifest shortcut, or a share-target hand-off. */
  openNew?: boolean
  initialTitle?: string
  children: React.ReactNode
}

const DEFERRED_KEY = 'descolga:permiso-diferido'

export function PendientesShell({
  kicker,
  title,
  insistHint,
  cadenceLine,
  quietLine,
  vapidPublicKey,
  hasReminders,
  openNew = false,
  initialTitle = '',
  children,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(openNew && !initialTitle)
  const [permission, setPermission] = useState<PushState | null>(null)
  const [askingPermission, setAskingPermission] = useState(false)

  // Notification.permission is a browser-only read, so it can't inform the
  // server render — resolve it after mount and let the banners appear then.
  useEffect(() => {
    setPermission(pushState())
  }, [])

  const deferred = useCallback(() => {
    try {
      return sessionStorage.getItem(DEFERRED_KEY) === '1'
    } catch {
      return false
    }
  }, [])

  const shouldAsk = permission === 'default' || permission === 'needs-install'

  useEffect(() => {
    if (hasReminders && shouldAsk && !deferred()) setAskingPermission(true)
  }, [hasReminders, shouldAsk, deferred])

  const dismissPermission = useCallback(() => {
    try {
      sessionStorage.setItem(DEFERRED_KEY, '1')
    } catch {
      // Private mode can refuse sessionStorage; the sheet just reappears later.
    }
    setAskingPermission(false)
  }, [])

  return (
    <>
      <header className="dg-topbar">
        <div>
          <div className="dg-kicker">{kicker}</div>
          <h1 className="dg-title">{title}</h1>
        </div>
        <Link
          href="/ajustes"
          className="btn btn-icon btn-secondary dg-round-btn dg-mobile-only"
          aria-label="Ajustes"
        >
          <GearIcon />
        </Link>
      </header>

      {permission === 'needs-install' && (
        <Link href="/instalar" className="dg-callout dg-callout--accent" style={{ margin: '0 16px 14px' }}>
          <span style={{ color: 'var(--color-accent)', display: 'flex', flex: 'none', marginTop: 2 }}>
            <ShareIcon />
          </span>
          <span>
            <span style={{ display: 'block', fontSize: 14, color: 'var(--color-text)' }}>
              Instalala para que te avise
            </span>
            <span className="dg-note">Safari solo manda avisos a las apps que están en la pantalla de inicio.</span>
          </span>
        </Link>
      )}

      {permission === 'denied' && (
        <Link href="/avisos" className="dg-callout dg-callout--warn" style={{ margin: '0 16px 14px' }}>
          <span style={{ color: 'var(--color-neutral-300)', display: 'flex', flex: 'none', marginTop: 2 }}>
            <BellOffIcon />
          </span>
          <span>
            <span style={{ display: 'block', fontSize: 14, color: 'var(--color-text)' }}>
              Los avisos están bloqueados
            </span>
            <span className="dg-note">Podés seguir anotando, pero nadie te va a insistir. Ver cómo reactivarlos.</span>
          </span>
        </Link>
      )}

      <QuickAdd
        insistHint={insistHint}
        initialTitle={initialTitle}
        autoFocus={Boolean(initialTitle) || openNew}
        onCreated={() => {
          if (shouldAsk && !deferred()) setAskingPermission(true)
        }}
      />

      {children}

      <button type="button" className="dg-fab" aria-label="Nuevo recordatorio" onClick={() => setSheetOpen(true)}>
        <PlusIcon size={24} />
      </button>

      {sheetOpen && (
        <NewReminderSheet
          insistHint={insistHint}
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            if (shouldAsk && !deferred()) setAskingPermission(true)
          }}
        />
      )}

      {askingPermission && (
        <PermissionSheet
          vapidPublicKey={vapidPublicKey}
          cadenceLine={cadenceLine}
          quietLine={quietLine}
          onDismiss={dismissPermission}
        />
      )}
    </>
  )
}
