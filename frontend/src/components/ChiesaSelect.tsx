import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { chieseApi, type Chiesa } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

/** Elenco delle chiese della parrocchia (per un utente limitato: solo la sua). */
export function useChiese() {
  return useQuery({
    queryKey: ['chiese'],
    queryFn: () => chieseApi.list(),
    staleTime: 5 * 60 * 1000,
  })
}

/** Converte il valore della <select> in id numerico (o null se "nessuna"). */
export const chiesaIdValue = (v: unknown) =>
  v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v)

/**
 * Campo "Chiesa" per i moduli (sacramenti, eventi).
 *
 * - `onSelect(chiesa, auto)` viene chiamato quando l'utente sceglie una chiesa
 *   (auto = false) e, se `preseleziona` è attivo, una volta all'apertura del
 *   modulo con la chiesa predefinita (auto = true): la chiesa dell'utente, se è
 *   limitato, altrimenti la chiesa parrocchiale.
 * - Per un utente limitato a una chiesa il campo è bloccato sulla sua chiesa.
 * - Non viene mostrato se la parrocchia non ha chiese configurate.
 */
export function ChiesaField({
  registration,
  onSelect,
  className,
  preseleziona = false,
  label = 'Chiesa',
  vuota = '— Non specificata —',
}: {
  registration: UseFormRegisterReturn
  onSelect?: (chiesa: Chiesa | undefined, auto: boolean) => void
  className: string
  preseleziona?: boolean
  label?: string
  vuota?: string
}) {
  const { data: chiese = [] } = useChiese()
  const { chiesaUtente } = useAuth()
  const fatto = useRef(false)

  useEffect(() => {
    if (fatto.current || chiese.length === 0) return
    if (!preseleziona && chiesaUtente === null) return
    fatto.current = true
    const predefinita = chiesaUtente !== null
      ? chiese.find(c => c.id === chiesaUtente)
      : chiese.find(c => c.principale && c.attiva)
    if (predefinita) onSelect?.(predefinita, true)
  }, [chiese, chiesaUtente, preseleziona, onSelect])

  if (chiese.length === 0) return null
  const bloccato = chiesaUtente !== null

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        {...registration}
        onChange={(e) => {
          registration.onChange(e)
          const id = chiesaIdValue(e.target.value)
          onSelect?.(chiese.find(c => c.id === id), false)
        }}
        disabled={bloccato}
        className={`${className} ${bloccato ? 'bg-gray-50 text-gray-600' : ''}`}
        title={bloccato ? 'Il tuo utente è assegnato a questa chiesa' : undefined}
      >
        {!bloccato && <option value="">{vuota}</option>}
        {chiese.map(c => (
          <option key={c.id} value={c.id}>
            {c.nome}{c.principale ? ' (parrocchiale)' : ''}{!c.attiva ? ' — non attiva' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Filtro per chiesa nelle liste; visibile solo se la parrocchia ha più chiese. */
export function ChiesaFilter({
  value,
  onChange,
  extra,
  tutte = 'Tutte le chiese',
}: {
  value: string
  onChange: (value: string) => void
  /** Opzioni aggiuntive in testa (es. la cassa della parrocchia) */
  extra?: { value: string; label: string }[]
  tutte?: string
}) {
  const { data: chiese = [] } = useChiese()
  const { chiesaUtente } = useAuth()
  if (chiesaUtente !== null) return null
  if (chiese.length < 2 && !extra?.length) return null

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
      title="Filtra per chiesa"
    >
      <option value="">{tutte}</option>
      {extra?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      {chiese.map(c => (
        <option key={c.id} value={c.id}>{c.nome}</option>
      ))}
    </select>
  )
}

/**
 * Prossimo numero del registro (tipo, chiesa, anno), per mostrarlo come
 * suggerimento nel campo "N. Registro" lasciato vuoto.
 */
export function useProssimoNumero(
  tipo: 'battesimi' | 'comunioni' | 'cresime' | 'matrimoni',
  chiesaId: unknown,
  dataSacramento: unknown,
  annoRegistro: unknown,
) {
  const { chiesaUtente } = useAuth()
  const annoNum = Number(annoRegistro)
  const anno = Number.isFinite(annoNum) && annoNum > 0
    ? annoNum
    : (typeof dataSacramento === 'string' && /^\d{4}/.test(dataSacramento) ? Number(dataSacramento.slice(0, 4)) : null)
  const cid = chiesaUtente ?? chiesaIdValue(chiesaId)
  const { data } = useQuery({
    queryKey: ['prossimo-numero', tipo, cid, anno],
    queryFn: () => chieseApi.prossimoNumero(tipo, anno as number, cid),
    enabled: anno !== null,
    staleTime: 10_000,
  })
  return { numero: anno !== null ? data : undefined, anno }
}

/** Testo d'aiuto sotto il campo "N. Registro". */
export function hintNumero(numero: number | undefined, anno: number | null) {
  return numero !== undefined && anno !== null
    ? `Vuoto = automatico (n. ${numero} del ${anno})`
    : 'Vuoto = numero automatico'
}
