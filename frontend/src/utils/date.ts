/**
 * Conversioni di formato data per la UI.
 * Storage e API:  ISO `yyyy-mm-dd`
 * Visualizzazione: `gg-mm-aaaa`
 */

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  // Estrae yyyy-mm-dd anche da datetime ISO completi
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}-${m[2]}-${m[1]}`
}

export function parseItDate(value: string): string | null {
  // gg-mm-aaaa o gg/mm/aaaa -> yyyy-mm-dd
  const m = value.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (!m) return null
  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  return `${m[3]}-${mm}-${dd}`
}

/** Numero di registro come "anno/numero" (es. 2026/12), o "—" se assente. */
export function numeroRegistro(r: { numero_registro?: string | null; anno_registro?: number | null }): string {
  const n = (r.numero_registro ?? '').toString().trim()
  if (!n) return '—'
  return r.anno_registro && !n.includes('/') ? `${r.anno_registro}/${n}` : n
}

/** Messaggio d'errore leggibile da una risposta dell'API. */
export function erroreApi(e: unknown, fallback = 'Operazione non riuscita'): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}
