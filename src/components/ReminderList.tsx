import type { GroupView } from '@/lib/view'
import { ReminderRow } from './ReminderRow'

type Props = {
  groups: GroupView[]
  activeId?: string
}

/**
 * The grouped list from design 1a: what insists comes first and is the only
 * thing that pulses; every other group is a plain fading rule.
 */
export function ReminderList({ groups, activeId }: Props) {
  return (
    <div className="dg-list">
      {groups.map((group) => (
        <section key={group.key} className={`dg-group dg-group--${group.key}`}>
          <header className="dg-group-head">
            <span className="dg-group-label">{group.label}</span>
            <span className="dg-group-rule" />
          </header>
          {group.items.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} active={reminder.id === activeId} />
          ))}
        </section>
      ))}
    </div>
  )
}
