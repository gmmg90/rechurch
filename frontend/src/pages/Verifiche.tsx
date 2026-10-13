import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, CheckCircle2, Pencil, Search, Droplets, Wheat, Star, Heart, Archive } from 'lucide-react'
import toast from 'react-hot-toast'
import { verificheApi, type ProblemaVerifica, type TipoVerifica } from '../api/client'
import { TableSkeleton } from '../components/LoadingSkeleton'

const TIPI: Record<TipoVerifica, { label: string; icon: React.ElementType; cls: string }> = {
  battesimi: { label: 'Battesimo', icon: Droplets, cls: 'bg-blue-50 text-blue-700' },
  comunioni: { label: 'Comunione', icon: Wheat, cls: 'bg-emerald-50 text-emerald-700' },
  cresime: { label: 'Cresima', icon: Star, cls: 'bg-amber-50 text-amber-700' },
  matrimoni: { label: 'Matrimonio', icon: Heart, cls: 'bg-rose-50 text-rose-700' },
  archivio: { label: 'Archivio', icon: Archive, cls: 'bg-gray-100 text-gray-700' },
}

const TABS: { id: 'tutti' | TipoVerifica; label: string }[] = [
  { id: 'tutti', label: 'Tutti' },
  { id: 'battesimi', label: 'Battesimi' },
  { id: 'comunioni', label: 'Comunioni' },
  { id: 'cresime', label: 'Cresime' },
  { id: 'matrimoni', label: 'Matrimoni' },
  { id: 'archivio', label: 'Archivio' },
]

export default function Verifiche() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'tutti' | TipoVerifica>('tutti')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { document.title = 'Da verificare — ReChurch' }, [])

  // Sempre ricalcolata all'apertura: si arriva qui spesso subito dopo aver corretto un record
  const { data, isLoading } = useQuery({
    queryKey: ['verifiche'],
    queryFn: verificheApi.lista,
    refetchOnMount: 'always',
  })
  const problemi = data?.problemi ?? []

  // Tiene allineato il contatore nel menu laterale
  useEffect(() => {
    if (data) qc.setQueryData(['verifiche-conteggio'], { totale: data.totale })
  }, [data, qc])

  const ignora = useMutation({
    mutationFn: (p: ProblemaVerifica) => verificheApi.ignora(p.chiave),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verifiche'] })
      qc.invalidateQueries({ queryKey: ['verifiche-conteggio'] })
      toast.success('Segnato come verificato')
    },
    onError: () => toast.error('Operazione non riuscita (serve il ruolo amministratore o segreteria)'),
  })

  const perTipo = useMemo(() => {
    const c: Record<string, number> = {}
    problemi.forEach(p => { c[p.tipo] = (c[p.tipo] ?? 0) + 1 })
    return c
  }, [problemi])

  const nelTab = problemi.filter(p => tab === 'tutti' || p.tipo === tab)
  const perCategoria = useMemo(() => {
    const c: Record<string, number> = {}
    nelTab.forEach(p => { c[p.categoria] = (c[p.categoria] ?? 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [nelTab])

  const q = search.trim().toLowerCase()
  const visibili = nelTab.filter(p =>
    (!categoria || p.categoria === categoria) &&
    (!q || p.persona.toLowerCase().includes(q) || p.messaggio.toLowerCase().includes(q))
  )

  const apri = (p: ProblemaVerifica) => {
    if (p.record_id == null) return
    navigate(`/${p.tipo}/${p.record_id}/modifica`, { state: { from: '/verifiche' } })
  }

  const conferma = (p: ProblemaVerifica) => {
    const testo = p.origine === 'controllo'
      ? 'Confermi che il dato è corretto così? Questo controllo non verrà più segnalato.'
      : 'Segnare questa segnalazione come risolta?'
    if (confirm(testo)) ignora.mutate(p)
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <ClipboardCheck className="text-indigo-600" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Da verificare</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Record con date incoerenti o dati da controllare. Quando correggi un record, sparisce dalla lista da solo;
            se un dato è insolito ma giusto, segnalo come corretto.
          </p>
        </div>
      </div>

      {/* Filtro per tipo */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
        {TABS.filter(t => t.id === 'tutti' || perTipo[t.id]).map(t => {
          const n = t.id === 'tutti' ? problemi.length : perTipo[t.id] ?? 0
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setCategoria(null) }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label} <span className="text-gray-400 font-normal">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Cerca per nome o problema..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {perCategoria.map(([cat, n]) => (
            <button
              key={cat}
              onClick={() => setCategoria(categoria === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                categoria === cat
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {cat} · {n}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={8} cols={4} /></div>
        ) : visibili.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-green-600" />
            </div>
            <p className="text-gray-700 font-medium">
              {problemi.length === 0 ? 'Tutto in ordine: nessun record da verificare' : 'Nessun risultato con questi filtri'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {visibili.map(p => {
              const t = TIPI[p.tipo] ?? TIPI.archivio
              const Icon = t.icon
              return (
                <li key={p.chiave} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 mt-0.5 ${t.cls}`}>
                      <Icon size={12} /> {t.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.persona}</p>
                      <p className="text-sm text-gray-600">{p.messaggio}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.categoria}{p.origine === 'import' && ' · nota dell’import dall’archivio'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 sm:ml-auto">
                    {p.record_id != null && (
                      <button
                        onClick={() => apri(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        <Pencil size={14} /> Correggi
                      </button>
                    )}
                    <button
                      onClick={() => conferma(p)}
                      disabled={ignora.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} /> {p.origine === 'controllo' ? 'È corretto' : 'Risolta'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
