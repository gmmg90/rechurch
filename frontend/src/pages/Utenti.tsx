import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Users, Plus, Pencil, UserX, UserCheck, X, KeyRound, Copy, Check } from 'lucide-react'
import { authApi, type AuthUser } from '../api/client'
import { useChiese } from '../components/ChiesaSelect'
import { useAuth } from '../contexts/AuthContext'
import { CardList, CardItem, IconAction, FabButton } from '../components/Mobile'

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
  /** '' = tutta la parrocchia */
  chiesa: string
}

const emptyForm: UserFormData = {
  nome: '',
  cognome: '',
  email: '',
  ruolo: 'lettura',
  password: '',
  chiesa: '',
}

const PASSWORD_MIN = 8

const dettaglioErrore = (err: unknown, def: string) =>
  (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? def

const inputCls =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'

export default function Utenti() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<AuthUser | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [reset, setReset] = useState<{ utente: AuthUser; password?: string } | null>(null)
  const [copiata, setCopiata] = useState(false)
  const { data: chiese = [] } = useChiese()
  const nomeChiesa = (id?: number | null) => chiese.find(c => c.id === id)?.nome

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
        chiesa_id: data.ruolo === 'admin' || !data.chiesa ? null : Number(data.chiesa),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utenti'] })
      toast.success('Utente creato con successo')
      closeModal()
    },
    onError: (err: unknown) => toast.error(dettaglioErrore(err, 'Errore nella creazione')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserFormData> }) =>
      authApi.updateUtente(id, {
        nome: data.nome,
        cognome: data.cognome,
        email: data.email,
        ruolo: data.ruolo,
        chiesa_id: data.ruolo === 'admin' || !data.chiesa ? null : Number(data.chiesa),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utenti'] })
      toast.success('Utente aggiornato')
      closeModal()
    },
    onError: (err: unknown) => toast.error(dettaglioErrore(err, "Errore nell'aggiornamento")),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, attivo }: { id: number; attivo: boolean }) =>
      authApi.updateUtente(id, { attivo }),
    onSuccess: (_, { attivo }) => {
      qc.invalidateQueries({ queryKey: ['utenti'] })
      toast.success(attivo ? 'Utente riattivato' : 'Utente disattivato')
    },
    onError: (err: unknown) => toast.error(dettaglioErrore(err, 'Errore')),
  })

  const resetMut = useMutation({
    mutationFn: (u: AuthUser) => authApi.resetPassword(u.id),
    onSuccess: (r, u) => {
      setReset({ utente: u, password: r.password_temporanea })
      qc.invalidateQueries({ queryKey: ['utenti'] })
    },
    onError: (err: unknown) => toast.error(dettaglioErrore(err, 'Errore nel reset della password')),
  })

  async function copia(testo: string) {
    try {
      await navigator.clipboard.writeText(testo)
      setCopiata(true)
      setTimeout(() => setCopiata(false), 2000)
    } catch {
      toast.error('Copia non riuscita: scrivila a mano')
    }
  }

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
      chiesa: u.chiesa_id ? String(u.chiesa_id) : '',
    })
    setEditTarget(u)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditTarget(null)
    setForm(emptyForm)
  }

  function chiudiReset() {
    setReset(null)
    setCopiata(false)
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

  if (isLoading) return <div className="p-4 sm:p-8 text-gray-400">Caricamento...</div>

  const avatar = (u: AuthUser, size = 'w-8 h-8 text-xs') => (
    <div className={`${size} rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 ${!u.attivo ? 'opacity-50' : ''}`}>
      <span className="text-indigo-700 font-bold">{u.nome.charAt(0)}{u.cognome.charAt(0)}</span>
    </div>
  )

  return (
    <div className="p-4 sm:p-8">
      <FabButton onClick={openCreate} label="Utente" />

      <p className="md:hidden text-sm text-gray-500 mb-3">
        Account per entrare nel programma. Tocca un utente per modificarlo; con la chiave gli crei una password provvisoria.
      </p>

      <div className="hidden md:flex items-center justify-between mb-6">
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

      {/* Telefono: schede */}
      <div className="md:hidden bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <CardList>
          {utenti.map(u => (
            <CardItem
              key={u.id}
              onClick={() => openEdit(u)}
              leading={avatar(u, 'w-10 h-10 text-sm')}
              title={<>{u.nome} {u.cognome}{u.id === me?.id && <span className="ml-1.5 text-xs text-indigo-500 font-normal">(tu)</span>}</>}
              subtitle={u.email}
              meta={
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${ROLE_COLORS[u.ruolo] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[u.ruolo] ?? u.ruolo}
                  </span>
                  {!u.attivo && <span className="rounded-full px-2 py-0.5 bg-gray-100 text-gray-500">Disattivato</span>}
                  {u.deve_cambiare_password && (
                    <span className="rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">Password provvisoria</span>
                  )}
                </span>
              }
              actions={u.id !== me?.id ? (
                <>
                  <IconAction label="Reimposta password" tone="indigo" onClick={() => setReset({ utente: u })}>
                    <KeyRound size={19} />
                  </IconAction>
                  <IconAction
                    label={u.attivo ? 'Disattiva' : 'Riattiva'}
                    tone={u.attivo ? 'red' : 'green'}
                    onClick={() => toggleMut.mutate({ id: u.id, attivo: !u.attivo })}
                  >
                    {u.attivo ? <UserX size={19} /> : <UserCheck size={19} />}
                  </IconAction>
                </>
              ) : undefined}
            />
          ))}
        </CardList>
        {utenti.length === 0 && <p className="text-center py-12 text-gray-400">Nessun utente trovato</p>}
      </div>

      {/* Computer: tabella */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utente</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ruolo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stato</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ultimo accesso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {utenti.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.attivo ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {avatar(u)}
                    <p className="font-medium text-gray-800">
                      {u.nome} {u.cognome}
                      {u.id === me?.id && <span className="ml-2 text-xs text-indigo-500 font-normal">(tu)</span>}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{u.email}</td>
                <td className="px-4 py-4">
                  <span className={`inline-block text-xs font-medium rounded-full px-2.5 py-1 ${ROLE_COLORS[u.ruolo] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[u.ruolo] ?? u.ruolo}
                  </span>
                  {u.chiesa_id && u.ruolo !== 'admin' && (
                    <p className="text-[11px] text-gray-500 mt-1">solo {nomeChiesa(u.chiesa_id) ?? 'chiesa eliminata'}</p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-block text-xs font-medium rounded-full px-2.5 py-1 ${
                    u.attivo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.attivo ? 'Attivo' : 'Disattivato'}
                  </span>
                  {u.deve_cambiare_password && (
                    <p className="text-[11px] text-amber-600 mt-1">password provvisoria</p>
                  )}
                </td>
                <td className="px-4 py-4 text-gray-500 text-xs">{formatDate(u.ultimo_accesso)}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(u)} title="Modifica"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    {u.id !== me?.id && (
                      <button onClick={() => setReset({ utente: u })} title="Reimposta password"
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <KeyRound size={15} />
                      </button>
                    )}
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
                <td colSpan={6} className="text-center py-12 text-gray-400">Nessun utente trovato</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Nuovo / modifica utente */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={closeModal}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto pb-safe"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                {modal === 'create' ? 'Nuovo utente' : 'Modifica utente'}
              </h2>
              <button onClick={closeModal} aria-label="Chiudi"
                className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input type="text" value={form.nome} onChange={set('nome')} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cognome *</label>
                  <input type="text" value={form.cognome} onChange={set('cognome')} required className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={set('email')} required autoComplete="off" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ruolo *</label>
                <select value={form.ruolo} onChange={set('ruolo')} disabled={editTarget?.id === me?.id} className={inputCls + ' disabled:bg-gray-50'}>
                  {RUOLI.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {chiese.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Accesso ai dati</label>
                  <select
                    value={form.ruolo === 'admin' ? '' : form.chiesa}
                    onChange={set('chiesa')}
                    disabled={form.ruolo === 'admin'}
                    className={inputCls + ' disabled:bg-gray-50'}
                  >
                    <option value="">Tutta la parrocchia</option>
                    {chiese.map(c => (
                      <option key={c.id} value={c.id}>Solo {c.nome}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {form.ruolo === 'admin'
                      ? 'Gli amministratori vedono sempre tutta la parrocchia.'
                      : form.chiesa
                        ? 'Vedrà e modificherà solo sacramenti, contabilità ed eventi di questa chiesa (niente rubrica anime e impostazioni).'
                        : 'Vede i dati di tutte le chiese della parrocchia.'}
                  </p>
                </div>
              )}

              {modal === 'create' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password provvisoria *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={PASSWORD_MIN}
                    autoComplete="new-password"
                    placeholder={`Minimo ${PASSWORD_MIN} caratteri`}
                    className={inputCls}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Al primo accesso l'utente dovrà sceglierne una sua.
                  </p>
                </div>
              )}

              {modal === 'edit' && editTarget && editTarget.id !== me?.id && (
                <button type="button" onClick={() => { const u = editTarget; closeModal(); setReset({ utente: u }) }}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-indigo-50">
                  <KeyRound size={16} /> Reimposta password
                </button>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="h-11 sm:h-auto px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  Annulla
                </button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                  className="h-11 sm:h-auto px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
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

      {/* Reimposta password */}
      {reset && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:p-4"
          onClick={() => { if (!reset.password) chiudiReset() }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-6 pb-safe space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <KeyRound size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-800">Reimposta password</h2>
                <p className="text-sm text-gray-500 truncate">{reset.utente.nome} {reset.utente.cognome} · {reset.utente.email}</p>
              </div>
            </div>

            {!reset.password ? (
              <>
                <p className="text-sm text-gray-600">
                  Verrà creata una <b>password provvisoria</b> da comunicare all'utente, a voce o di persona.
                  Al primo accesso dovrà sceglierne una sua. Se è collegato da altri dispositivi, verrà scollegato.
                </p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <button onClick={chiudiReset}
                    className="h-11 px-4 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                    Annulla
                  </button>
                  <button onClick={() => resetMut.mutate(reset.utente)} disabled={resetMut.isPending}
                    className="h-11 px-5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {resetMut.isPending ? 'Attendere...' : 'Crea password provvisoria'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Password provvisoria</p>
                  <p className="font-mono text-2xl font-semibold tracking-wider text-gray-900 select-all break-all">
                    {reset.password}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  Comunicala a {reset.utente.nome}: <b>non verrà più mostrata</b>. Se va persa, basta reimpostarla di nuovo.
                </p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <button onClick={() => copia(reset.password!)}
                    className="h-11 px-4 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                    {copiata ? <><Check size={16} className="text-green-600" /> Copiata</> : <><Copy size={16} /> Copia</>}
                  </button>
                  <button onClick={chiudiReset}
                    className="h-11 px-5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                    Fatto
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
