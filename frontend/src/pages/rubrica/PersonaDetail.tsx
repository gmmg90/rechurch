import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Pencil, X, Search, Link as LinkIcon, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  rubricaApi, battesimiApi, cresimeApi, matrimoniApi,
  type Battesimo, type Cresima, type Matrimonio,
} from '../../api/client'

type SacramentoTipo = 'battesimo' | 'cresima' | 'matrimonio'

function CollegaModal({
  tipo,
  personaId,
  onClose,
}: {
  tipo: SacramentoTipo
  personaId: number
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

  const { data: battesimi = [] } = useQuery({
    queryKey: ['battesimi-modal', dSearch],
    queryFn: () => battesimiApi.list({ search: dSearch || undefined, limit: 20 }),
    enabled: tipo === 'battesimo',
  })
  const { data: cresime = [] } = useQuery({
    queryKey: ['cresime-modal', dSearch],
    queryFn: () => cresimeApi.list({ search: dSearch || undefined, limit: 20 }),
    enabled: tipo === 'cresima',
  })
  const { data: matrimoni = [] } = useQuery({
    queryKey: ['matrimoni-modal', dSearch],
    queryFn: () => matrimoniApi.list({ search: dSearch || undefined, limit: 20 }),
    enabled: tipo === 'matrimonio',
  })

  const link = useMutation({
    mutationFn: ({ sacramento_id, ruolo }: { sacramento_id: number; ruolo?: string }) =>
      rubricaApi.linkSacramento(personaId, tipo, sacramento_id, ruolo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['persona', String(personaId)] })
      toast.success('Collegamento creato')
      onClose()
    },
    onError: () => toast.error('Errore nel collegamento'),
  })

  const itemsBattesimo = battesimi as Battesimo[]
  const itemsCresima = cresime as Cresima[]
  const itemsMatrimonio = matrimoni as Matrimonio[]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 text-lg">
            Collega {tipo === 'battesimo' ? 'Battesimo' : tipo === 'cresima' ? 'Cresima' : 'Matrimonio'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

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
          {tipo === 'battesimo' && itemsBattesimo.map(b => (
            <button
              key={b.id}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 rounded-lg transition-colors"
              onClick={() => link.mutate({ sacramento_id: b.id })}
            >
              <p className="font-medium text-sm text-gray-800">{b.nome} {b.cognome}</p>
              <p className="text-xs text-gray-500">{b.data_battesimo} — {b.luogo_battesimo}</p>
            </button>
          ))}
          {tipo === 'cresima' && itemsCresima.map(c => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 rounded-lg transition-colors"
              onClick={() => link.mutate({ sacramento_id: c.id })}
            >
              <p className="font-medium text-sm text-gray-800">{c.nome} {c.cognome}</p>
              <p className="text-xs text-gray-500">{c.data_cresima} — {c.luogo_cresima}</p>
            </button>
          ))}
          {tipo === 'matrimonio' && itemsMatrimonio.map(m => (
            <div key={m.id} className="px-3 py-2.5">
              <p className="font-medium text-sm text-gray-800 mb-1">
                {m.sposo_nome} {m.sposo_cognome} & {m.sposa_nome} {m.sposa_cognome}
              </p>
              <p className="text-xs text-gray-500 mb-2">{m.data_matrimonio} — {m.luogo_matrimonio}</p>
              <div className="flex gap-2">
                <button
                  className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
                  onClick={() => link.mutate({ sacramento_id: m.id, ruolo: 'sposo' })}
                >
                  Come sposo
                </button>
                <button
                  className="text-xs px-2.5 py-1 bg-pink-100 text-pink-700 rounded-md hover:bg-pink-200"
                  onClick={() => link.mutate({ sacramento_id: m.id, ruolo: 'sposa' })}
                >
                  Come sposa
                </button>
              </div>
            </div>
          ))}
          {tipo === 'battesimo' && itemsBattesimo.length === 0 && (
            <p className="text-sm text-gray-400 p-3 text-center">Nessun battesimo trovato</p>
          )}
          {tipo === 'cresima' && itemsCresima.length === 0 && (
            <p className="text-sm text-gray-400 p-3 text-center">Nessuna cresima trovata</p>
          )}
          {tipo === 'matrimonio' && itemsMatrimonio.length === 0 && (
            <p className="text-sm text-gray-400 p-3 text-center">Nessun matrimonio trovato</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PersonaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [collegaModal, setCollegaModal] = useState<SacramentoTipo | null>(null)

  const { data: persona, isLoading } = useQuery({
    queryKey: ['persona', id],
    queryFn: () => rubricaApi.getPersona(Number(id)),
    enabled: Boolean(id),
  })

  const unlink = useMutation({
    mutationFn: (tipo: string) => rubricaApi.unlinkSacramento(Number(id), tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['persona', id] })
      toast.success('Collegamento rimosso')
    },
    onError: () => toast.error('Errore nella rimozione'),
  })

  if (isLoading) {
    return <div className="p-8 text-gray-400">Caricamento...</div>
  }
  if (!persona) {
    return <div className="p-8 text-gray-400">Persona non trovata</div>
  }

  const initials = `${persona.nome.charAt(0)}${persona.cognome.charAt(0)}`.toUpperCase()

  const formatDate = (d?: string) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('it-IT')
    } catch {
      return d
    }
  }

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
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {persona.nome} {persona.cognome}
              </h1>
              {persona.sesso && (
                <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  persona.sesso === 'M'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-pink-100 text-pink-700'
                }`}>
                  {persona.sesso === 'M' ? 'Maschio' : 'Femmina'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/rubrica/persone/${id}/modifica`)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Pencil size={15} /> Modifica
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Dati anagrafici */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Dati Anagrafici</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32 flex-shrink-0">Data nascita</dt>
              <dd className="text-gray-800">{formatDate(persona.data_nascita)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32 flex-shrink-0">Luogo nascita</dt>
              <dd className="text-gray-800">{persona.luogo_nascita ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32 flex-shrink-0">Indirizzo</dt>
              <dd className="text-gray-800">{persona.indirizzo ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32 flex-shrink-0">CAP / Città</dt>
              <dd className="text-gray-800">
                {[persona.cap, persona.citta].filter(Boolean).join(' ') || '—'}
              </dd>
            </div>
            {persona.note && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-32 flex-shrink-0">Note</dt>
                <dd className="text-gray-800">{persona.note}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Contatti e Famiglia */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Contatti</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 flex-shrink-0">Telefono</dt>
                <dd className="text-gray-800">{persona.telefono ?? '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 flex-shrink-0">Email</dt>
                <dd className="text-gray-800">{persona.email ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Famiglia</h2>
            {persona.famiglia_id ? (
              <Link
                to={`/rubrica/famiglie/${persona.famiglia_id}`}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                <ExternalLink size={14} />
                Fam. {persona.famiglia_cognome}
              </Link>
            ) : (
              <p className="text-sm text-gray-400">Nessuna famiglia associata</p>
            )}
          </div>
        </div>
      </div>

      {/* Sacramenti */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Sacramenti</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Battesimo */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
              Battesimo
            </h3>
            {persona.battesimo ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-800 font-medium">
                  {persona.battesimo.nome} {persona.battesimo.cognome}
                </p>
                <p className="text-xs text-gray-500">{persona.battesimo.data_battesimo}</p>
                <p className="text-xs text-gray-500">{persona.battesimo.luogo_battesimo}</p>
                <div className="flex gap-2 mt-3">
                  <Link
                    to={`/battesimi/${persona.battesimo.id}/modifica`}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> Vai al registro
                  </Link>
                </div>
                <button
                  onClick={() => unlink.mutate('battesimo')}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={11} /> Rimuovi collegamento
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCollegaModal('battesimo')}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <LinkIcon size={12} /> Collega
              </button>
            )}
          </div>

          {/* Cresima */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
              Cresima
            </h3>
            {persona.cresima ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-800 font-medium">
                  {persona.cresima.nome} {persona.cresima.cognome}
                </p>
                <p className="text-xs text-gray-500">{persona.cresima.data_cresima}</p>
                <p className="text-xs text-gray-500">{persona.cresima.luogo_cresima}</p>
                <div className="flex gap-2 mt-3">
                  <Link
                    to={`/cresime/${persona.cresima.id}/modifica`}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> Vai al registro
                  </Link>
                </div>
                <button
                  onClick={() => unlink.mutate('cresima')}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={11} /> Rimuovi collegamento
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCollegaModal('cresima')}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <LinkIcon size={12} /> Collega
              </button>
            )}
          </div>

          {/* Matrimonio */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
              Matrimonio
            </h3>
            {persona.matrimonio ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-800 font-medium">
                  {persona.matrimonio.sposo_nome} {persona.matrimonio.sposo_cognome} &{' '}
                  {persona.matrimonio.sposa_nome} {persona.matrimonio.sposa_cognome}
                </p>
                {persona.ruolo_matrimonio && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    persona.ruolo_matrimonio === 'sposo'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-pink-100 text-pink-700'
                  }`}>
                    {persona.ruolo_matrimonio}
                  </span>
                )}
                <p className="text-xs text-gray-500">{persona.matrimonio.data_matrimonio}</p>
                <p className="text-xs text-gray-500">{persona.matrimonio.luogo_matrimonio}</p>
                <div className="flex gap-2 mt-3">
                  <Link
                    to={`/matrimoni/${persona.matrimonio.id}/modifica`}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> Vai al registro
                  </Link>
                </div>
                <button
                  onClick={() => unlink.mutate('matrimonio')}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={11} /> Rimuovi collegamento
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCollegaModal('matrimonio')}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <LinkIcon size={12} /> Collega
              </button>
            )}
          </div>
        </div>
      </div>

      {collegaModal && (
        <CollegaModal
          tipo={collegaModal}
          personaId={Number(id)}
          onClose={() => setCollegaModal(null)}
        />
      )}
    </div>
  )
}
