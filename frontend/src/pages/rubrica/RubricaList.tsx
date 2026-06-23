import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, Eye, Users, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import { rubricaApi, type Persona, type Famiglia } from '../../api/client'

type Tab = 'persone' | 'famiglie'

export default function RubricaList() {
  const [tab, setTab] = useState<Tab>('persone')
  const [rawSearch, setRawSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Simple debounce via onChange
  const handleSearch = (v: string) => {
    setRawSearch(v)
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => setDebouncedSearch(v),
      300
    )
  }

  const { data: persone = [], isLoading: loadingPersone } = useQuery({
    queryKey: ['persone', debouncedSearch],
    queryFn: () => rubricaApi.listPersone({ search: debouncedSearch || undefined }),
    enabled: tab === 'persone',
  })

  const { data: famiglie = [], isLoading: loadingFamiglie } = useQuery({
    queryKey: ['famiglie', debouncedSearch],
    queryFn: () => rubricaApi.listFamiglie({ search: debouncedSearch || undefined }),
    enabled: tab === 'famiglie',
  })

  const delPersona = useMutation({
    mutationFn: (id: number) => rubricaApi.deletePersona(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['persone'] })
      toast.success('Persona eliminata')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Errore durante l\'eliminazione'),
  })

  const delFamiglia = useMutation({
    mutationFn: (id: number) => rubricaApi.deleteFamiglia(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['famiglie'] })
      toast.success('Famiglia eliminata')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Errore durante l\'eliminazione'),
  })

  const handleDeletePersona = (p: Persona) => {
    if (deleteConfirm === p.id) {
      delPersona.mutate(p.id)
    } else {
      setDeleteConfirm(p.id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const handleDeleteFamiglia = (f: Famiglia) => {
    if (deleteConfirm === f.id) {
      delFamiglia.mutate(f.id)
    } else {
      setDeleteConfirm(f.id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const isLoading = tab === 'persone' ? loadingPersone : loadingFamiglie

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Rubrica Anime</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {tab === 'persone' ? `${persone.length} persone` : `${famiglie.length} famiglie`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === 'persone' ? (
            <button
              onClick={() => navigate('/rubrica/persone/nuova')}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> Nuova Persona
            </button>
          ) : (
            <button
              onClick={() => navigate('/rubrica/famiglie/nuova')}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> Nuova Famiglia
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setTab('persone'); setRawSearch(''); setDebouncedSearch('') }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'persone'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Persone
        </button>
        <button
          onClick={() => { setTab('famiglie'); setRawSearch(''); setDebouncedSearch('') }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'famiglie'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Famiglie
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder={tab === 'persone' ? 'Cerca per nome, cognome, città, telefono, email...' : 'Cerca per cognome, città...'}
              value={rawSearch}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : tab === 'persone' ? (
          persone.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nessuna persona trovata</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Cognome</th>
                    <th className="px-4 py-3 font-medium">Famiglia</th>
                    <th className="px-4 py-3 font-medium">Città</th>
                    <th className="px-4 py-3 font-medium">Telefono</th>
                    <th className="px-4 py-3 font-medium w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {persone.map(p => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/rubrica/persone/${p.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{p.nome}</td>
                      <td className="px-4 py-3 text-gray-700">{p.cognome}</td>
                      <td className="px-4 py-3 text-gray-600">{p.famiglia_cognome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.citta ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{p.telefono ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/rubrica/persone/${p.id}`)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Scheda"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => navigate(`/rubrica/persone/${p.id}/modifica`)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Modifica"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeletePersona(p)}
                            className={`p-1.5 rounded transition-colors ${
                              deleteConfirm === p.id
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={deleteConfirm === p.id ? 'Conferma eliminazione' : 'Elimina'}
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
          )
        ) : (
          famiglie.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nessuna famiglia trovata</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Cognome</th>
                    <th className="px-4 py-3 font-medium">Città</th>
                    <th className="px-4 py-3 font-medium">N° Membri</th>
                    <th className="px-4 py-3 font-medium">Telefono</th>
                    <th className="px-4 py-3 font-medium w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {famiglie.map(f => (
                    <tr
                      key={f.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/rubrica/famiglie/${f.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">Fam. {f.cognome}</td>
                      <td className="px-4 py-3 text-gray-600">{f.citta ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} className="text-gray-400" />
                          {f.num_persone ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{f.telefono ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/rubrica/famiglie/${f.id}`)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Scheda"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteFamiglia(f)}
                            className={`p-1.5 rounded transition-colors ${
                              deleteConfirm === f.id
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={deleteConfirm === f.id ? 'Conferma eliminazione' : 'Elimina'}
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
          )
        )}
      </div>
    </div>
  )
}
