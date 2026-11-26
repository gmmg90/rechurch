import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Cake, Heart, PartyPopper } from 'lucide-react'
import { matrimoniApi, rubricaApi } from '../../api/client'

const GIORNI = 14
type Filtro = 'tutte' | 'anniversario' | 'compleanno'

const giorno = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

const quando = (g: number) => (g === 0 ? 'Oggi' : g === 1 ? 'Domani' : `Tra ${g} giorni`)

/** Anniversari di matrimonio e compleanni dei prossimi giorni. */
export default function RicorrenzeWidget({ compatto = false }: { compatto?: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>('tutte')
  const [tutte, setTutte] = useState(false)

  const { data: anniversari = [], isLoading: l1 } = useQuery({
    queryKey: ['ricorrenze-anniversari', GIORNI],
    queryFn: () => matrimoniApi.anniversariProssimi(GIORNI),
    staleTime: 10 * 60_000,
    retry: false,
  })
  const { data: compleanni = [], isLoading: l2 } = useQuery({
    queryKey: ['ricorrenze-compleanni', GIORNI],
    queryFn: () => rubricaApi.complegenniProssimi(GIORNI),
    staleTime: 10 * 60_000,
    retry: false, // la rubrica puo' essere spenta o non accessibile: in quel caso solo anniversari
  })

  const voci = [
    ...anniversari.map(a => ({
      key: `a${a.id}`,
      tipo: 'anniversario' as const,
      to: `/matrimoni/${a.id}/modifica`,
      nome: `${a.sposo} e ${a.sposa}`,
      dettaglio: `${a.anni}° anniversario di matrimonio`,
      giorni: a.giorni_mancanti,
      data: a.data_anniversario,
    })),
    ...compleanni.map(c => ({
      key: `c${c.id}`,
      tipo: 'compleanno' as const,
      to: `/rubrica/persone/${c.id}`,
      nome: `${c.cognome} ${c.nome}`,
      dettaglio: `Compie ${c.eta} anni`,
      giorni: c.giorni_mancanti,
      data: c.data_compleanno,
    })),
  ]
    .filter(v => filtro === 'tutte' || v.tipo === filtro)
    .sort((a, b) => a.giorni - b.giorni || a.nome.localeCompare(b.nome))

  const limite = compatto && !tutte ? 6 : voci.length
  const oggi = voci.filter(v => v.giorni === 0).length

  const chip = (f: Filtro, label: string, n: number) => (
    <button
      type="button"
      onClick={() => { setFiltro(f); setTutte(false) }}
      className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        filtro === f ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label} <span className="opacity-70">{n}</span>
    </button>
  )

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PartyPopper className="text-rose-500" size={18} />
          <h3 className="font-semibold text-gray-800 text-sm">Ricorrenze</h3>
          <span className="text-xs text-gray-400">prossimi {GIORNI} giorni</span>
        </div>
        {oggi > 0 && (
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 rounded-full px-2 py-0.5">{oggi} oggi</span>
        )}
      </div>

      <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
        {chip('tutte', 'Tutte', anniversari.length + compleanni.length)}
        {chip('anniversario', 'Anniversari', anniversari.length)}
        {compleanni.length > 0 && chip('compleanno', 'Compleanni', compleanni.length)}
      </div>

      {l1 || l2 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm py-6">Caricamento...</div>
      ) : voci.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm py-6 text-center">
          Nessuna ricorrenza nei prossimi {GIORNI} giorni
        </div>
      ) : (
        <>
          <ul className="flex-1 overflow-y-auto min-h-0 -mx-1">
            {voci.slice(0, limite).map(v => (
              <li key={v.key}>
                <Link to={v.to} className="flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-gray-50 active:bg-gray-100">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    v.tipo === 'anniversario' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'
                  }`}>
                    {v.tipo === 'anniversario' ? <Heart size={16} /> : <Cake size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-800 truncate">{v.nome}</span>
                    <span className="block text-xs text-gray-500 truncate">{v.dettaglio}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className={`block text-xs font-semibold ${v.giorni === 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                      {quando(v.giorni)}
                    </span>
                    <span className="block text-[11px] text-gray-400 capitalize">{giorno(v.data)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {voci.length > limite && (
            <button type="button" onClick={() => setTutte(true)}
              className="mt-1 h-10 text-sm font-medium text-indigo-600 active:bg-indigo-50 rounded-lg">
              Mostra tutte ({voci.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
