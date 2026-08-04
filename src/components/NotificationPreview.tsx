/**
 * Design 1f, rendered as a real preview so the copy and hierarchy of the push
 * are visible before the user grants permission. Top: Android, where the aviso
 * stays in the tray and carries actions. Bottom: iOS, where it can't be pinned —
 * so the repeat counter is what does the insisting.
 */
export function NotificationPreview({ cadence, dueLine }: { cadence: string; dueLine: string }) {
  return (
    <div className="dg-notif-stage">
      <div>
        <div className="dg-notif-label">Android · queda fija</div>
        <div className="dg-notif">
          <div style={{ padding: '14px 16px 12px' }}>
            <div className="dg-notif-head">
              <span className="dg-notif-glyph">D</span>
              <span>Descolgá</span>
              <span>·</span>
              <span>ahora</span>
              <span
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: 'var(--color-accent-300)',
                }}
              >
                <span className="dg-pulse" style={{ width: 6, height: 6 }}>
                  <span className="dg-pulse-core" />
                  <span className="dg-pulse-ring" style={{ inset: -4 }} />
                </span>
                aviso 3 de 5
              </span>
            </div>
            <div style={{ fontSize: 17, marginTop: 9 }}>Llevar el auto a lavar</div>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', marginTop: 3 }}>
              {dueLine} Sigo insistiendo hasta que lo marqués.
            </div>
          </div>
          <div className="dg-notif-actions">
            <span className="dg-notif-action dg-notif-action--primary">Hecho</span>
            <span className="dg-notif-action">Posponer 1 h</span>
          </div>
        </div>
      </div>

      <div>
        <div className="dg-notif-label">iOS · insiste, no se fija</div>
        <div className="dg-notif--ios">
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--color-accent-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: 'var(--color-accent)',
              flex: 'none',
            }}
          >
            D
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 14, fontFamily: 'var(--font-heading)', fontWeight: 500 }}>
                Llevar el auto a lavar
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-neutral-500)', flex: 'none' }}>
                ahora
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', marginTop: 2 }}>
              Aviso 3 de 5 · {dueLine.toLowerCase()} Cada {cadence} hasta que lo marqués.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
