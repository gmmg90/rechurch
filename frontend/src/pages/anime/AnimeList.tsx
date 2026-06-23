import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, Users, Droplets, Cookie, Star, Heart, ChevronRight } from 'lucide-react'
import { animeApi } from '../../api/client'
import { formatDate } from '../../utils/date'

const PAGE_SIZE = 50

type Filter = 'tutti' | 'battesimo' | 'comunione' | 'cresima' | 'matrimonio'

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function AnimeList() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('tutti')
  const [page, setPage] = useState(0)

  const dq = useDebouncedValue(search.trim(), 250)

  const { data, isLoading } = useQuery({
    queryKey: ['anime', dq, filter, page],
    queryFn: () => animeApi.list({
      search: dq || undefined,
      has_battesimo: filter === 'battesimo' ? true : undefined,
      has_comunione: filter === 'comunione' ? true : undefined,
      has_cresima: filter === 'cresima' ? true : undefined,
      has_matrimonio: filter === 'matrimonio' ? true : undefined,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
  })

  const total = data?.total ?? 0
  const items = data?.items ?? []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 bg-violet-100 rounded-xl">
          <Users className="text-violet-600" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Anime</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Persone uniche aggregate per nome, cognome e data di nascita — {total.toLocaleString('it-IT')} risultati
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="Cerca per nome o cognome…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
            />
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['tutti', 'battesimo', 'comunione', 'cresima', 'matrimonio'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(0) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'tutti' ? 'Tutti' : `Con ${f}`}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Caricamento…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nessuna anima trovata</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Cognome e Nome</th>
                  <th className="px-4 py-3 font-medium">Data nascita</th>
                  <th className="px-4 py-3 font-medium">Luogo nascita</th>
                  <th className="px-4 py-3 font-medium text-center">Sacramenti</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-violet-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/anime/${a.id}`} className="text-gray-800 hover:text-violet-700 font-medium">
                        {a.cognome} {a.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(a.data_nascita)}</td>
                    <td className="px-4 py-3 text-gray-600">{a.luogo_nascita ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {a.battesimi_count > 0 && (
                          <span title={`${a.battesimi_count} battesimo/i`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                            <Droplets size={11} /> {a.battesimi_count}
                          </span>
                        )}
                        {a.comunioni_count > 0 && (
                          <span title={`${a.comunioni_count} comunione/i`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                            <Cookie size={11} /> {a.comunioni_count}
                          </span>
                        )}
                        {a.cresime_count > 0 && (
                          <span title={`${a.cresime_count} cresima/e`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                            <Star size={11} /> {a.cresime_count}
                          </span>
                        )}
                        {a.matrimoni_count > 0 && (
                          <span title={`${a.matrimoni_count} matrimonio/i`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-xs rounded-full">
                            <Heart size={11} /> {a.matrimoni_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/anime/${a.id}`}
                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded inline-flex">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-500">
              Pagina {page + 1} di {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                ← Precedente
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Successiva →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
