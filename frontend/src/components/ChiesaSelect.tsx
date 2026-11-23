import { useQuery } from '@tanstack/react-query'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { chieseApi, type Chiesa } from '../api/client'

/** Elenco delle chiese della parrocchia (condiviso in cache da tutte le pagine). */
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
 * Campo "Chiesa" per i form dei sacramenti. Scegliendo una chiesa viene
 * richiamato `onSelect`, che i form usano per compilare il luogo di celebrazione.
 * Non viene mostrato se la parrocchia non ha ancora chiese configurate.
 */
export function ChiesaField({
  registration,
  onSelect,
  className,
}: {
  registration: UseFormRegisterReturn
  onSelect?: (chiesa: Chiesa | undefined) => void
  className: string
}) {
  const { data: chiese = [] } = useChiese()
  if (chiese.length === 0) return null

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Chiesa</label>
      <select
        {...registration}
        onChange={(e) => {
          registration.onChange(e)
          const id = chiesaIdValue(e.target.value)
          onSelect?.(chiese.find(c => c.id === id))
        }}
        className={className}
      >
        <option value="">— Non specificata —</option>
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
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { data: chiese = [] } = useChiese()
  if (chiese.length < 2) return null

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
      title="Filtra per chiesa"
    >
      <option value="">Tutte le chiese</option>
      {chiese.map(c => (
        <option key={c.id} value={c.id}>{c.nome}</option>
      ))}
    </select>
  )
}
