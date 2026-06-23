import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, FileDown, Droplets } from 'lucide-react'
import toast from 'react-hot-toast'
import { battesimiApi, pdfApi, type Battesimo } from '../../api/client'
import Pagination from '../../components/Pagination'
import { TableSkeleton } from '../../components/LoadingSkeleton'

const PAGE_SIZE = 50

export default function BattesimiList() {
  const [search, setSearch] = useState('')
  const [anno, setAnno] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => { document.title = 'Battesimi — ReChurch' }, [])
  useEffect(() => { setPage(1) }, [search, anno])

  const { data: result, isLoading } = useQuery({
    queryKey: ['battesimi', search, anno, page],
    queryFn: () => battesimiApi.listWithTotal({
      search: search || undefined,
      anno: anno ? Number(anno) : undefined,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
  })

  const data = result?.data ?? []
  const total = result?.total ?? 0

  const del = useMutation({
    mutationFn: (b: Battesimo) => battesimiApi.delete(b.id),
    onSuccess: (_data, b) => {
      qc.invalidateQueries({ queryKey: ['battesimi'] })
      toast.success(`Battesimo di ${b.nome} ${b.cognome} eliminato`)
    },
    onError: () => toast.error('Errore durante l\'eliminazione'),
  })

  const handleDelete = (b: Battesimo) => {
    if (confirm(`Eliminare il battesimo di ${b.nome} ${b.cognome}?`)) del.mutate(b)
  }

  const hasSearch = !!(search || anno)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Battesimi</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} record trovati</p>
        </div>
        <Link
          to="/battesimi/nuovo"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Nuovo
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Cerca per nome, ministro, luogo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <input
            type="number"
            className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Anno"
            value={anno}
            onChange={e => setAnno(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Cognome</th>
                  <th className="px-4 py-3 font-medium">Data battesimo</th>
                  <th className="px-4 py-3 font-medium">Luogo</th>
                  <th className="px-4 py-3 font-medium">Ministro</th>
                  <th className="px-4 py-3 font-medium">N. Registro</th>
                  <th className="px-4 py-3 font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <Droplets size={20} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">Nessun risultato</p>
                        {hasSearch
                          ? <p className="text-gray-400 text-sm">Prova a modificare i filtri di ricerca</p>
                          : <Link to="/battesimi/nuovo" className="text-indigo-600 text-sm hover:underline">Aggiungi il primo record</Link>
                        }
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map(b => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{b.nome}</td>
                      <td className="px-4 py-3 text-gray-700">{b.cognome}</td>
                      <td className="px-4 py-3 text-gray-600">{b.data_battesimo}</td>
                      <td className="px-4 py-3 text-gray-600">{b.luogo_battesimo}</td>
                      <td className="px-4 py-3 text-gray-600">{b.ministro}</td>
                      <td className="px-4 py-3 text-gray-500">{b.numero_registro ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <a
                            href={pdfApi.battesimoUrl(b.id)}
                            target="_blank"
                            rel="noreferrer"
                            title="Scarica PDF"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          >
                            <FileDown size={15} />
                          </a>
                          <button
                            onClick={() => navigate(`/battesimi/${b.id}/modifica`)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(b)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && total > PAGE_SIZE && (
          <div className="px-4 pb-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}
