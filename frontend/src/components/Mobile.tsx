import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'

/** Pulsante "+" flottante, solo su telefono (sopra la barra di navigazione). */
export function Fab({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="md:hidden fixed right-4 bottom-above-nav z-20 flex items-center gap-2 rounded-full bg-indigo-600 text-white pl-4 pr-5 h-14 shadow-lg shadow-indigo-900/25 active:scale-95 transition-transform font-semibold"
    >
      <Plus size={22} /> {label}
    </Link>
  )
}

export function FabButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="md:hidden fixed right-4 bottom-above-nav z-20 flex items-center gap-2 rounded-full bg-indigo-600 text-white pl-4 pr-5 h-14 shadow-lg shadow-indigo-900/25 active:scale-95 transition-transform font-semibold"
    >
      <Plus size={22} /> {label}
    </button>
  )
}

/** Elenco a schede per il telefono (le tabelle restano su schermi grandi). */
export function CardList({ children }: { children: ReactNode }) {
  return <ul className="md:hidden divide-y divide-gray-100">{children}</ul>
}

type CardProps = {
  to?: string
  onClick?: () => void
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  aside?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
}

/** Riga di un elenco su telefono: tocco sull'area principale, azioni piccole a destra. */
export function CardItem({ to, onClick, title, subtitle, meta, aside, leading, actions }: CardProps) {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-gray-900 truncate">{title}</p>
          {aside && <span className="shrink-0 text-sm text-gray-500 tabular-nums">{aside}</span>}
        </div>
        {subtitle && <p className="text-sm text-gray-600 truncate mt-0.5">{subtitle}</p>}
        {meta && <div className="text-xs text-gray-400 mt-1 truncate">{meta}</div>}
      </div>
      {(to || onClick) && !actions && <ChevronRight size={18} className="shrink-0 text-gray-300" />}
    </>
  )
  const cls = 'flex items-center gap-3 min-w-0 flex-1 py-3.5 pl-4 pr-2 active:bg-gray-50'
  return (
    <li className="flex items-center">
      {to ? (
        <Link to={to} className={cls}>{body}</Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls + ' text-left'}>{body}</button>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {actions && <div className="flex items-center pr-2">{actions}</div>}
    </li>
  )
}

/** Icona-pulsante con area di tocco da 44px. */
export function IconAction({
  onClick, href, label, children, tone = 'gray',
}: {
  onClick?: () => void
  href?: string
  label: string
  children: ReactNode
  tone?: 'gray' | 'red' | 'green' | 'indigo'
}) {
  const colors = {
    gray: 'text-gray-400 active:bg-gray-100',
    red: 'text-gray-400 active:bg-red-50 active:text-red-600',
    green: 'text-gray-400 active:bg-green-50 active:text-green-600',
    indigo: 'text-indigo-500 active:bg-indigo-50',
  }[tone]
  const cls = `w-11 h-11 flex items-center justify-center rounded-full ${colors}`
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={cls}>{children}</a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>{children}</button>
  )
}

/** Riquadro "nessun risultato" condiviso tra tabella e schede. */
export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">{icon}</div>
      <p className="text-gray-500 font-medium">{title}</p>
      {children}
    </div>
  )
}
