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
