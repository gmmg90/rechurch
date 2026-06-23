import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, FileDown, Eye, Printer } from 'lucide-react'
import { matrimoniApi, pdfApi, type Matrimonio } from '../../api/client'
import { formatDate } from '../../utils/date'

export default function MatrimoniList() {
  const [search, setSearch] = useState('')
  const [anno, setAnno] = useState('')
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['matrimoni', search, anno],
    queryFn: () => matrimoniApi.list({ search: search || undefined, anno: anno ? Number(anno) : undefined }),
  })

  const del = useMutation({
    mutationFn: (id: number) => matrimoniApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matrimoni'] }),
  })

  const handleDelete = (m: Matrimonio) => {
    if (confirm(`Eliminare il matrimonio di ${m.sposo_cognome} e ${m.sposa_cognome}?`)) del.mutate(m.id)
  }

  const handleStampaElenco = () => {
    const url = pdfApi.elencoView('matrimoni', { search, anno })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Matrimoni</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data.length} record trovati</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleStampaElenco}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            title="Stampa elenco filtrato"
          >
            <Printer size={16} /> Stampa elenco
          </button>
          <Link
            to="/matrimoni/nuovo"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Nuovo
          </Link>
        </div>
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
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nessun matrimonio trovato</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Sposo</th>
                  <th className="px-4 py-3 font-medium">Sposa</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Luogo</th>
                  <th className="px-4 py-3 font-medium">Ministro</th>
                  <th className="px-4 py-3 font-medium">N. Registro</th>
                  <th className="px-4 py-3 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {data.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{m.sposo_nome} {m.sposo_cognome}</td>
                    <td className="px-4 py-3 text-gray-700">{m.sposa_nome} {m.sposa_cognome}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(m.data_matrimonio)}</td>
                    <td className="px-4 py-3 text-gray-600">{m.luogo_matrimonio ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.ministro ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.numero_registro ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => navigate(`/matrimoni/${m.id}/certificato`)}
                          title="Visualizza certificato"
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        <a
                          href={pdfApi.matrimonioUrl(m.id)}
                          target="_blank"
                          rel="noreferrer"
                          title="Scarica PDF"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        >
                          <FileDown size={15} />
                        </a>
                        <button
                          onClick={() => navigate(`/matrimoni/${m.id}/modifica`)}
                          title="Modifica"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
