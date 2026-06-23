import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Pencil, X, Search, UserPlus, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { rubricaApi, type Persona } from '../../api/client'

function AggiungMembroModal({
  famigliaId,
  onClose,
}: {
  famigliaId: number
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [dSearch, setDSearch] = useState('')
  const qc = useQueryClient()

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDSearch(v), 300)
  }

  const { data: persone = [] } = useQuery({
    queryKey: ['persone-modal', dSearch],
    queryFn: () => rubricaApi.listPersone({ search: dSearch || undefined, limit: 20 }),
  })

  const assign = useMutation({
    mutationFn: (personaId: number) =>
      rubricaApi.updatePersona(personaId, { famiglia_id: famigliaId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['famiglia', String(famigliaId)] })
      qc.invalidateQueries({ queryKey: ['persone'] })
      toast.success('Membro aggiunto alla famiglia')
      onClose()
    },
    onError: () => toast.error('Errore nell\'assegnazione'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 text-lg">Aggiungi membro</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Cerca una persona esistente e assegnala a questa famiglia.
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Cerca per nome, cognome..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
          {persone.map(p => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-between"
              onClick={() => assign.mutate(p.id)}
            >
              <div>
                <p className="font-medium text-sm text-gray-800">{p.nome} {p.cognome}</p>
                {p.citta && <p className="text-xs text-gray-500">{p.citta}</p>}
                {p.famiglia_cognome && (
                  <p className="text-xs text-orange-500">Già in Fam. {p.famiglia_cognome}</p>
                )}
              </div>
              <UserPlus size={14} className="text-indigo-400 flex-shrink-0 ml-2" />
            </button>
          ))}
          {persone.length === 0 && (
            <p className="text-sm text-gray-400 p-3 text-center">Nessuna persona trovata</p>
          )}
        </div>
      </div>
    </div>
  )
}

function EditFamigliaModal({
  famiglia,
  onClose,
}: {
  famiglia: { id: number; cognome: string; indirizzo?: string; cap?: string; citta?: string; telefono?: string; note?: string }
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    cognome: famiglia.cognome,
    indirizzo: famiglia.indirizzo ?? '',
    cap: famiglia.cap ?? '',
    citta: famiglia.citta ?? '',
    telefono: famiglia.telefono ?? '',
    note: famiglia.note ?? '',
  })

  const update = useMutation({
    mutationFn: () => rubricaApi.updateFamiglia(famiglia.id, {
      cognome: form.cognome,
      indirizzo: form.indirizzo || undefined,
      cap: form.cap || undefined,
      citta: form.citta || undefined,
      telefono: form.telefono || undefined,
      note: form.note || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['famiglia', String(famiglia.id)] })
      qc.invalidateQueries({ queryKey: ['famiglie'] })
      toast.success('Famiglia aggiornata')
      onClose()
    },
    onError: () => toast.error('Errore nell\'aggiornamento'),
  })

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 text-lg">Modifica Famiglia</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cognome *</label>
            <input
              className={inputCls}
              value={form.cognome}
              onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
            <input
              className={inputCls}
              value={form.indirizzo}
              onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
              <input
                className={inputCls}
                value={form.cap}
                onChange={e => setForm(f => ({ ...f, cap: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
              <input
                className={inputCls}
                value={form.citta}
                onChange={e => setForm(f => ({ ...f, citta: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
            <input
              className={inputCls}
              value={form.telefono}
              onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              className={inputCls}
              rows={2}
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={() => update.mutate()}
            disabled={!form.cognome || update.isPending}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {update.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FamigliaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showAddMembro, setShowAddMembro] = useState(false)
  const [showEditFamiglia, setShowEditFamiglia] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['famiglia', id],
    queryFn: () => rubricaApi.getFamiglia(Number(id)),
    enabled: Boolean(id),
  })

  const removeMembro = useMutation({
    mutationFn: (personaId: number) =>
      rubricaApi.updatePersona(personaId, { famiglia_id: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['famiglia', id] })
      qc.invalidateQueries({ queryKey: ['persone'] })
      toast.success('Membro rimosso dalla famiglia')
    },
    onError: () => toast.error('Errore nella rimozione'),
  })

  if (isLoading) {
    return <div className="p-8 text-gray-400">Caricamento...</div>
  }
  if (!data) {
    return <div className="p-8 text-gray-400">Famiglia non trovata</div>
  }

  const persone: Persona[] = data.persone ?? []

  return (
    <div className="p-8 max-w-4xl">
      <button
        onClick={() => navigate('/rubrica')}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-6"
      >
        <ChevronLeft size={16} /> Rubrica
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Famiglia {data.cognome}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{persone.length} membri</p>
          </div>
          <button
            onClick={() => setShowEditFamiglia(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Pencil size={15} /> Modifica
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Informazioni</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24 flex-shrink-0">Indirizzo</dt>
            <dd className="text-gray-800">{data.indirizzo ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24 flex-shrink-0">CAP / Città</dt>
            <dd className="text-gray-800">
              {[data.cap, data.citta].filter(Boolean).join(' ') || '—'}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24 flex-shrink-0">Telefono</dt>
            <dd className="text-gray-800">{data.telefono ?? '—'}</dd>
          </div>
          {data.note && (
            <div className="flex gap-2 col-span-2">
              <dt className="text-gray-500 w-24 flex-shrink-0">Note</dt>
              <dd className="text-gray-800">{data.note}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Membri */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Membri</h2>
          <button
            onClick={() => setShowAddMembro(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            <UserPlus size={13} /> Aggiungi membro
          </button>
        </div>

        {persone.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nessun membro in questa famiglia</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cognome</th>
                <th className="px-4 py-3 font-medium">Città</th>
                <th className="px-4 py-3 font-medium">Telefono</th>
                <th className="px-4 py-3 font-medium w-28"></th>
              </tr>
            </thead>
            <tbody>
              {persone.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-700">{p.cognome}</td>
                  <td className="px-4 py-3 text-gray-600">{p.citta ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.telefono ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => navigate(`/rubrica/persone/${p.id}`)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Scheda"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => removeMembro.mutate(p.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Rimuovi dalla famiglia"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddMembro && (
        <AggiungMembroModal
          famigliaId={Number(id)}
          onClose={() => setShowAddMembro(false)}
        />
      )}

      {showEditFamiglia && data && (
        <EditFamigliaModal
          famiglia={data}
          onClose={() => setShowEditFamiglia(false)}
        />
      )}
    </div>
  )
}
