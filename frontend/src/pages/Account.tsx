import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { KeyRound, LogOut, ShieldAlert, Eye, EyeOff, UserCircle } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const RUOLI: Record<string, string> = {
  admin: 'Amministratore', segreteria: 'Segreteria', economo: 'Economo', lettura: 'Sola lettura',
}
const MIN = 8

const errore = (e: unknown, def: string) =>
  (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? def

/** Il mio account: dati dell'utente e cambio password (obbligatorio se la password è provvisoria). */
export default function Account() {
  const { user, logout, aggiornaSessione } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const obbligo = !!user?.deve_cambiare_password
  const [attuale, setAttuale] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [mostra, setMostra] = useState(false)
  const [invio, setInvio] = useState(false)

  const problema =
    nuova && nuova.length < MIN ? `Almeno ${MIN} caratteri`
    : conferma && nuova !== conferma ? 'Le due password non coincidono'
    : nuova && nuova === attuale ? 'Deve essere diversa da quella attuale'
    : null

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    if (problema || !attuale || !nuova || nuova !== conferma) return
    setInvio(true)
    try {
      const r = await authApi.cambiaPassword(attuale, nuova)
      await aggiornaSessione(r.access_token)
      qc.invalidateQueries() // ricarica moduli e dati bloccati finche' la password era provvisoria
      setAttuale(''); setNuova(''); setConferma('')
      toast.success('Password cambiata. Sugli altri dispositivi dovrai rientrare.')
      if (obbligo) navigate('/', { replace: true })
    } catch (err) {
      toast.error(errore(err, 'Errore nel cambio password'))
    } finally {
      setInvio(false)
    }
  }

  if (!user) return null
  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <h1 className="hidden md:flex items-center gap-2 text-2xl font-bold text-gray-800 mb-6">
        <UserCircle className="text-indigo-600" size={26} /> Il mio account
      </h1>

      {obbligo && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-5">
          <ShieldAlert className="text-amber-600 shrink-0" size={22} />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Scegli una password personale</p>
            <p className="mt-0.5">
              Stai usando una password provvisoria data dall'amministratore. Per continuare scegline una tua:
              la conosci solo tu.
            </p>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
            {user.nome.charAt(0)}{user.cognome.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate">{user.nome} {user.cognome}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            <p className="text-xs text-indigo-600 mt-0.5">{RUOLI[user.ruolo] ?? user.ruolo}</p>
          </div>
        </div>
      </section>

      <form onSubmit={salva} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800">
          <KeyRound size={18} className="text-indigo-500" /> Cambia password
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {obbligo ? 'Password provvisoria' : 'Password attuale'}
          </label>
          <input type={mostra ? 'text' : 'password'} value={attuale} onChange={e => setAttuale(e.target.value)}
            autoComplete="current-password" required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nuova password</label>
          <input type={mostra ? 'text' : 'password'} value={nuova} onChange={e => setNuova(e.target.value)}
            autoComplete="new-password" required minLength={MIN} className={inputCls}
            placeholder={`Almeno ${MIN} caratteri`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ripeti la nuova password</label>
          <input type={mostra ? 'text' : 'password'} value={conferma} onChange={e => setConferma(e.target.value)}
            autoComplete="new-password" required className={inputCls} />
        </div>
        <button type="button" onClick={() => setMostra(m => !m)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 h-9">
          {mostra ? <EyeOff size={16} /> : <Eye size={16} />} {mostra ? 'Nascondi' : 'Mostra'} le password
        </button>
        {problema && <p className="text-sm text-red-600">{problema}</p>}
        <button type="submit" disabled={invio || !!problema || !attuale || !nuova || !conferma}
          className="w-full sm:w-auto h-11 px-6 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {invio ? 'Salvataggio...' : 'Salva la nuova password'}
        </button>
      </form>

      <button onClick={logout}
        className="md:hidden mt-5 w-full h-11 flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
        <LogOut size={16} /> Esci
      </button>
    </div>
  )
}
