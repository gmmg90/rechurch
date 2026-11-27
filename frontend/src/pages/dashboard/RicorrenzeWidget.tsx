import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Heart, Gem } from 'lucide-react'
import { matrimoniApi } from '../../api/client'

/** Giorni mostrati nella vista "Prossimi" */
const GIORNI = 14
/** Quanto avanti si cercano le nozze importanti */
const GIORNI_IMPORTANTI = 365

/** Anniversari "con nome" (tradizione italiana): anni -> nome e colore */
export const NOZZE: Record<number, { nome: string; cls: string }> = {
  1: { nome: 'di carta', cls: 'bg-stone-100 text-stone-600' },
  5: { nome: 'di legno', cls: 'bg-orange-100 text-orange-800' },
  10: { nome: 'di stagno', cls: 'bg-slate-100 text-slate-600' },
  15: { nome: 'di cristallo', cls: 'bg-cyan-50 text-cyan-700' },
  20: { nome: 'di porcellana', cls: 'bg-blue-50 text-blue-700' },
  25: { nome: "d'argento", cls: 'bg-gray-200 text-gray-700' },
  30: { nome: 'di perle', cls: 'bg-pink-50 text-pink-700' },
  35: { nome: 'di corallo', cls: 'bg-orange-50 text-orange-600' },
  40: { nome: 'di smeraldo', cls: 'bg-emerald-50 text-emerald-700' },
  45: { nome: 'di rubino', cls: 'bg-red-50 text-red-700' },
  50: { nome: "d'oro", cls: 'bg-amber-100 text-amber-800' },
  60: { nome: 'di diamante', cls: 'bg-sky-50 text-sky-700' },
  70: { nome: 'di platino', cls: 'bg-zinc-100 text-zinc-700' },
}

type Vista = 'prossimi' | 'importanti'

const giorno = (iso: string, conAnno = false) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: conAnno ? undefined : 'short', day: 'numeric', month: 'short', year: conAnno ? 'numeric' : undefined,
  })

const quando = (g: number) => (g === 0 ? 'Oggi' : g === 1 ? 'Domani' : `Tra ${g} giorni`)

/** Anniversari di matrimonio: i prossimi giorni e le nozze importanti dell'anno. */
export default function RicorrenzeWidget({ compatto = false }: { compatto?: boolean }) {
  const [vista, setVista] = useState<Vista>('prossimi')
  const [anni, setAnni] = useState<number | null>(null) // filtro sulle nozze importanti
  const [tutte, setTutte] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['ricorrenze-anniversari', GIORNI_IMPORTANTI],
    queryFn: () => matrimoniApi.anniversariProssimi(GIORNI_IMPORTANTI),
    staleTime: 10 * 60_000,
    retry: false,
  })

  const prossimi = data.filter(a => a.giorni_mancanti <= GIORNI)
  const importanti = data.filter(a => NOZZE[a.anni])
  const perAnni = Object.keys(NOZZE).map(Number)
    .map(n => ({ n, tot: importanti.filter(a => a.anni === n).length }))
    .filter(x => x.tot > 0)

  const voci = (vista === 'prossimi' ? prossimi : importanti.filter(a => anni === null || a.anni === anni))
    .slice()
    .sort((a, b) => a.giorni_mancanti - b.giorni_mancanti || a.sposo.localeCompare(b.sposo))
  const limite = compatto && !tutte ? 6 : voci.length
  const oggi = prossimi.filter(a => a.giorni_mancanti === 0).length

  const chip = (attivo: boolean, onClick: () => void, label: string, n?: number, piccolo = false) => (
    <button
      type="button"
      onClick={() => { onClick(); setTutte(false) }}
      className={`${piccolo ? 'px-2.5 h-7' : 'px-3 h-8'} rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        attivo ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}{n !== undefined && <span className="opacity-70"> {n}</span>}
    </button>
  )

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className="text-rose-500" size={18} />
          <h3 className="font-semibold text-gray-800 text-sm">Anniversari di matrimonio</h3>
        </div>
        {oggi > 0 && (
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 rounded-full px-2 py-0.5">{oggi} oggi</span>
        )}
      </div>

      <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
        {chip(vista === 'prossimi', () => setVista('prossimi'), `Prossimi ${GIORNI} giorni`, prossimi.length)}
        {chip(vista === 'importanti', () => { setVista('importanti'); setAnni(null) }, 'Nozze importanti', importanti.length)}
      </div>

      {vista === 'importanti' && perAnni.length > 0 && (
        <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar md:flex-wrap">
          {chip(anni === null, () => setAnni(null), 'Tutte', undefined, true)}
          {perAnni.map(({ n, tot }) => chip(anni === n, () => setAnni(n), `${n}° ${NOZZE[n].nome}`, tot, true))}
        </div>
      )}
      {vista === 'importanti' && (
        <p className="text-[11px] text-gray-400 mb-1">Nei prossimi 12 mesi</p>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm py-6">Caricamento...</div>
      ) : voci.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm py-6 text-center">
          {vista === 'prossimi' ? `Nessun anniversario nei prossimi ${GIORNI} giorni` : 'Nessuna nozze importante nei prossimi 12 mesi'}
        </div>
      ) : (
        <>
          <ul className="flex-1 overflow-y-auto min-h-0 -mx-1">
            {voci.slice(0, limite).map(a => {
              const nozze = NOZZE[a.anni]
              return (
                <li key={a.id}>
                  <Link to={`/matrimoni/${a.id}/modifica`}
                    className="flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-gray-50 active:bg-gray-100">
                    <span className={`w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0 leading-none ${
                      nozze ? nozze.cls : 'bg-rose-50 text-rose-500'
                    }`}>
                      <span className="text-sm font-bold">{a.anni}</span>
                      <span className="text-[9px] mt-0.5">anni</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{a.sposo} e {a.sposa}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500 truncate">
                        {nozze ? <><Gem size={11} className="shrink-0" /> Nozze {nozze.nome}</> : `${a.anni}° anniversario`}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={`block text-xs font-semibold ${a.giorni_mancanti === 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                        {a.giorni_mancanti <= 31 ? quando(a.giorni_mancanti) : giorno(a.data_anniversario, true)}
                      </span>
                      <span className="block text-[11px] text-gray-400">sposati nel {a.data_matrimonio.slice(0, 4)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {voci.length > limite && (
            <button type="button" onClick={() => setTutte(true)}
              className="mt-1 h-10 text-sm font-medium text-indigo-600 active:bg-indigo-50 rounded-lg">
              Mostra tutti ({voci.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
