import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Users, Plus, Pencil, UserX, UserCheck, X } from 'lucide-react'
import { authApi, type AuthUser } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const RUOLI = ['admin', 'segreteria', 'economo', 'lettura'] as const
type Ruolo = (typeof RUOLI)[number]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  segreteria: 'Segreteria',
  economo: 'Economo',
  lettura: 'Sola lettura',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  segreteria: 'bg-blue-100 text-blue-700',
  economo: 'bg-amber-100 text-amber-700',
  lettura: 'bg-gray-100 text-gray-600',
}

interface UserFormData {
  nome: string
  cognome: string
  email: string
  ruolo: Ruolo
  password: string
}

const emptyForm: UserFormData = {
  nome: '',
  cognome: '',
  email: '',
  ruolo: 'lettura',
  password: '',
}

export default function Utenti() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<AuthUser | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)

  const { data: utenti = [], isLoading } = useQuery({
    queryKey: ['utenti'],
    queryFn: authApi.listUtenti,
  })

  const createMut = useMutation({
    mutationFn: (data: UserFormData) =>
      authApi.createUtente({
        nome: data.nome,
        cognome: data.cognome,
        email: data.email,
        ruolo: data.ruolo,
        password: data.password,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utenti'] })
      toast.success('Utente creato con successo')
      closeModal()
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Errore nella creazione'
      toast.error(msg)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormData> }) =>
      authApi.updateUtente(id, {
        nome: data.nome,
        cognome: data.cognome,
        email: data.email,
        ruolo: data.ruolo,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utenti'] })
      toast.success('Utente aggiornato')
      closeModal()
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Errore nell\'aggiornamento'
      toast.error(msg)
    },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, attivo }: { id: number; attivo: boolean }) =>
      authApi.updateUtente(id, { attivo }),
    onSuccess: (_, { attivo }) => {
      qc.invalidateQueries({ queryKey: ['utenti'] })
      toast.success(attivo ? 'Utente riattivato' : 'Utente disattivato')
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Errore'
      toast.error(msg)
    },
  })

  function openCreate() {
    setForm(emptyForm)
    setEditTarget(null)
    setModal('create')
  }

  function openEdit(u: AuthUser) {
    setForm({
      nome: u.nome,
      cognome: u.cognome,
      email: u.email,
      ruolo: u.ruolo as Ruolo,
      password: '',
    })
    setEditTarget(u)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditTarget(null)
    setForm(emptyForm)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (modal === 'create') {
      createMut.mutate(form)
    } else if (modal === 'edit' && editTarget) {
      updateMut.mutate({ id: editTarget.id, data: form })
    }
  }

  const set = (k: keyof UserFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [k]: e.target.value }))

  const formatDate = (iso?: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) return <div className="p-8 text-gray-400">Caricamento...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Gestione Utenti</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Amministra gli account di accesso al sistema
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Nuovo utente
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Utente
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Ruolo
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stato
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Ultimo accesso
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {utenti.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.attivo ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-700 text-xs font-bold">
                        {u.nome.charAt(0)}{u.cognome.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {u.nome} {u.cognome}
                        {u.id === me?.id && (
                          <span className="ml-2 text-xs text-indigo-500 font-normal">(tu)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{u.email}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-block text-xs font-medium rounded-full px-2.5 py-1 ${
                      ROLE_COLORS[u.ruolo] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ROLE_LABELS[u.ruolo] ?? u.ruolo}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-block text-xs font-medium rounded-full px-2.5 py-1 ${
                      u.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {u.attivo ? 'Attivo' : 'Disattivato'}
                  </span>
                </td>
                <td className="px-4 py-4 text-gray-500 text-xs">{formatDate(u.ultimo_accesso)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(u)}
                      title="Modifica"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    {u.id !== me?.id && (
                      <button
                        onClick={() => toggleMut.mutate({ id: u.id, attivo: !u.attivo })}
                        title={u.attivo ? 'Disattiva' : 'Riattiva'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.attivo
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {u.attivo ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {utenti.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  Nessun utente trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                {modal === 'create' ? 'Nuovo utente' : 'Modifica utente'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={set('nome')}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cognome *</label>
                  <input
                    type="text"
                    value={form.cognome}
                    onChange={set('cognome')}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ruolo *</label>
                <select
                  value={form.ruolo}
                  onChange={set('ruolo')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {RUOLI.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {modal === 'create' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={6}
                    placeholder="Minimo 6 caratteri"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {createMut.isPending || updateMut.isPending
                    ? 'Salvataggio...'
                    : modal === 'create'
                    ? 'Crea utente'
                    : 'Salva modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
