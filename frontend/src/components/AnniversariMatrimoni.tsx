import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Heart, Cake, ChevronRight, Sparkles, Gift } from 'lucide-react'
import { statsApi, type Anniversario } from '../api/client'
import { formatDate } from '../utils/date'

type Periodo = 'oggi' | 'settimana' | 'mese'

const PERIODO_LABEL: Record<Periodo, string> = {
  oggi: 'Oggi',
  settimana: 'Questa settimana',
  mese: 'Questo mese',
}

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

// Etichette per anniversari "speciali"
function specialAnniversary(anni: number): { label: string; emoji: string } | null {
  if (anni === 25) return { label: 'Nozze d\'Argento', emoji: '🥈' }
  if (anni === 50) return { label: 'Nozze d\'Oro', emoji: '🥇' }
  if (anni === 60) return { label: 'Nozze di Diamante', emoji: '💎' }
  if (anni === 75) return { label: 'Nozze di Platino', emoji: '✨' }
  if (anni > 0 && anni % 10 === 0) return { label: `${anni}° anniversario`, emoji: '🎉' }
  return null
}

function GroupedItems({ items }: { items: Anniversario[] }) {
  // Raggruppa per data (mese-giorno)
  const groups = items.reduce<Record<string, Anniversario[]>>((acc, it) => {
    acc[it.mese_giorno] = acc[it.mese_giorno] ?? []
    acc[it.mese_giorno].push(it)
    return acc
  }, {})

  const sortedKeys = Object.keys(groups).sort()

  return (
    <div className="space-y-4">
      {sortedKeys.map(key => {
        const [mm, dd] = key.split('-')
        const label = `${parseInt(dd)} ${MESI[parseInt(mm) - 1]}`
        return (
          <div key={key}>
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2 px-1">
              {label}
            </p>
            <div className="space-y-1.5">
              {groups[key].map(it => {
                const special = specialAnniversary(it.anniversario_anni)
                return (
                  <Link
                    key={it.id}
                    to={`/matrimoni/${it.id}/certificato`}
                    className="group flex items-center gap-3 p-3 bg-white border border-rose-100 rounded-lg hover:border-rose-300 hover:bg-rose-50/50 transition-colors"
                  >
                    <div className={`shrink-0 p-2 rounded-lg ${
                      special ? 'bg-gradient-to-br from-amber-400 to-rose-500' : 'bg-rose-100'
                    }`}>
                      <Heart size={16} className={special ? 'text-white' : 'text-rose-600'} fill={special ? 'currentColor' : 'none'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {it.sposo_nome} {it.sposo_cognome}
                        <span className="text-rose-400 mx-1.5">♥</span>
                        {it.sposa_nome} {it.sposa_cognome}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>{formatDate(it.data_matrimonio)}</span>
                        <span>•</span>
                        <span className={`font-medium ${special ? 'text-amber-600' : 'text-rose-600'}`}>
                          {special && <span className="mr-1">{special.emoji}</span>}
                          {special ? special.label : `${it.anniversario_anni}° anniversario`}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-rose-400" />
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AnniversariMatrimoni() {
  const [periodo, setPeriodo] = useState<Periodo>('settimana')

  const { data, isLoading } = useQuery({
    queryKey: ['anniversari', 'matrimoni', periodo],
    queryFn: () => statsApi.anniversariMatrimoni({ periodo }),
  })

  const items = data?.items ?? []
  const totale = data?.totale ?? 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-400 to-rose-600 rounded-xl">
            <Cake className="text-white" size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              Anniversari di matrimonio
              <Sparkles size={14} className="text-amber-500" />
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Coppie a cui fare gli auguri
            </p>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['oggi', 'settimana', 'mese'] as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                periodo === p ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Banner riepilogo */}
      {!isLoading && totale > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-100 rounded-lg text-sm text-rose-700 mb-4">
          <Gift size={14} className="text-rose-500" />
          <span><strong>{totale}</strong> {totale === 1 ? 'coppia' : 'coppie'} {periodo === 'oggi' ? 'oggi' : `${PERIODO_LABEL[periodo].toLowerCase()}`} festeggia l'anniversario</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-400 py-8 text-sm">Caricamento…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <Heart className="mx-auto text-gray-200 mb-3" size={32} />
          <p className="text-sm text-gray-400">
            Nessun anniversario {periodo === 'oggi' ? 'oggi' : `in ${PERIODO_LABEL[periodo].toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto pr-1 -mr-1">
          <GroupedItems items={items} />
        </div>
      )}
    </div>
  )
}
