import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, Server, Database, Users, Droplets, Star, Heart,
  BookOpen, Wallet, CalendarDays, ScanLine, Upload, HardDrive,
  Clock, Cake, Church, ChevronRight, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { configApi, rubricaApi, matrimoniApi, backupApi } from '../api/client'
import { useModuli } from '../contexts/ModuliContext'

const ICONE: Record<string, React.ElementType> = {
  Droplets, Star, Heart, BookOpen, Wallet, CalendarDays, ScanLine, Upload,
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })

function ToggleSwitch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${value ? 'bg-indigo-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function StatCard({ label, value, icon: Icon, color = 'indigo' }: {
  label: string; value: string | number; icon: React.ElementType; color?: string
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color] ?? colors.indigo}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function Amministrazione() {
  const { moduliList, toggle, isLoading: moduliLoading } = useModuli()
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => { document.title = 'Amministrazione — ReChurch' }, [])

  const { data: sistema, isLoading: sistemaLoading, refetch: refetchSistema } = useQuery({
    queryKey: ['sistema'],
    queryFn: () => configApi.getSistema(),
  })

  const { data: compleanni = [] } = useQuery({
    queryKey: ['compleanni-prossimi-admin'],
    queryFn: () => rubricaApi.complegenniProssimi(14),
  })

  const { data: anniversari = [] } = useQuery({
    queryKey: ['anniversari-prossimi-admin'],
    queryFn: () => matrimoniApi.anniversariProssimi(14),
  })

  const backupNow = useMutation({
    mutationFn: () => backupApi.esegui(),
    onSuccess: () => {
      toast.success('Backup eseguito con successo')
      refetchSistema()
    },
    onError: () => toast.error('Errore nel backup'),
  })

  const handleToggle = async (codice: string, current: boolean) => {
    setToggling(codice)
    try {
      await toggle(codice, !current)
      toast.success(`Modulo ${!current ? 'attivato' : 'disattivato'}`)
    } catch {
      toast.error('Errore nel salvataggio')
    } finally {
      setToggling(null)
    }
  }

  const allEvents = [
    ...compleanni.map(c => ({
      tipo: 'compleanno' as const,
      nome: `${c.nome} ${c.cognome}`,
      giorni: c.giorni_mancanti,
      dettaglio: c.giorni_mancanti === 0 ? `Oggi — ${c.eta} anni` : `Tra ${c.giorni_mancanti} giorni — ${c.eta} anni`,
      data: c.data_compleanno,
    })),
    ...anniversari.map(a => ({
      tipo: 'anniversario' as const,
      nome: `${a.sposo} & ${a.sposa}`,
      giorni: a.giorni_mancanti,
      dettaglio: a.giorni_mancanti === 0 ? `Oggi — ${a.anni}° anniversario` : `Tra ${a.giorni_mancanti} giorni — ${a.anni}° anniversario`,
      data: a.data_anniversario,
    })),
  ].sort((a, b) => a.giorni - b.giorni)

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-indigo-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Amministrazione</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gestione moduli, sistema e scadenze</p>
          </div>
        </div>
        <button
          onClick={() => refetchSistema()}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Aggiorna"
        >
          <RefreshCw size={18} className={sistemaLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Statistiche sistema */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Statistiche sistema</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Battesimi" value={sistema?.totale_battesimi ?? '—'} icon={Droplets} color="blue" />
              <StatCard label="Cresime"   value={sistema?.totale_cresime ?? '—'}   icon={Star}     color="violet" />
              <StatCard label="Matrimoni" value={sistema?.totale_matrimoni ?? '—'} icon={Heart}    color="red" />
              <StatCard label="Persone"   value={sistema?.totale_persone ?? '—'}   icon={Users}    color="green" />
              <StatCard label="Movimenti" value={sistema?.totale_movimenti ?? '—'} icon={Wallet}   color="amber" />
              <StatCard label="Utenti att." value={sistema?.totale_utenti ?? '—'} icon={ShieldCheck} color="indigo" />
            </div>
          </section>

          {/* Moduli */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Moduli attivi</h2>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {moduliLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Caricamento moduli...</div>
              ) : (
                moduliList.map(modulo => {
                  const Icon = ICONE[modulo.icona ?? ''] ?? Church
                  return (
                    <div key={modulo.codice} className="flex items-center gap-4 px-5 py-4">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${modulo.attivo ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${modulo.attivo ? 'text-gray-800' : 'text-gray-400'}`}>
                          {modulo.nome}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{modulo.descrizione}</p>
                      </div>
                      <ToggleSwitch
                        value={modulo.attivo}
                        onChange={() => handleToggle(modulo.codice, modulo.attivo)}
                        disabled={toggling === modulo.codice}
                      />
                    </div>
                  )
                })
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 px-1">I moduli disattivati vengono nascosti dalla navigazione.</p>
          </section>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Info sistema */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Info sistema</h2>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-gray-500 flex items-center gap-2"><Server size={14} /> Versione</span>
                <span className="font-mono font-semibold text-gray-800">{sistema?.versione ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-gray-500 flex items-center gap-2"><HardDrive size={14} /> Database</span>
                <span className="font-semibold text-gray-800">{sistema ? `${sistema.db_size_mb} MB` : '—'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-gray-500 flex items-center gap-2"><Clock size={14} /> Ultimo backup</span>
                <span className="text-gray-800 text-xs">{sistema?.ultimo_backup ?? 'Mai'}</span>
              </div>
            </div>
          </section>

          {/* Azioni rapide */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Azioni rapide</h2>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              <button
                onClick={() => backupNow.mutate()}
                disabled={backupNow.isPending}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-gray-700">
                  <Database size={14} className="text-indigo-500" />
                  {backupNow.isPending ? 'Backup in corso...' : 'Esegui backup ora'}
                </span>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
              <Link
                to="/utenti"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-gray-700">
                  <Users size={14} className="text-indigo-500" />
                  Gestione utenti
                </span>
                <ChevronRight size={14} className="text-gray-400" />
              </Link>
              <Link
                to="/impostazioni"
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-gray-700">
                  <Church size={14} className="text-indigo-500" />
                  Dati parrocchia
                </span>
                <ChevronRight size={14} className="text-gray-400" />
              </Link>
            </div>
          </section>

          {/* Prossimi eventi (compleanni + anniversari) */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Prossimi 14 giorni
            </h2>
            {allEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
                Nessun compleanno o anniversario
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {allEvents.slice(0, 8).map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${ev.tipo === 'compleanno' ? 'bg-pink-50 text-pink-500' : 'bg-rose-50 text-rose-500'}`}>
                      {ev.tipo === 'compleanno' ? <Cake size={13} /> : <Heart size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{ev.nome}</p>
                      <p className="text-xs text-gray-400">{ev.dettaglio}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(ev.data)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
