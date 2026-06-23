import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Droplets, Star, Heart, TrendingUp, Plus, Search, X,
  ArrowRight, CalendarRange,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts'
import {
  statsApi, battesimiApi, cresimeApi, matrimoniApi,
  type StatsPeriod, type Battesimo, type Cresima, type Matrimonio,
} from '../api/client'

// ── Colori ────────────────────────────────────────────────────────────────────
const C = { battesimi: '#3b82f6', cresime: '#f59e0b', matrimoni: '#f43f5e' }
const MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPeriodo(p: string, gran: string) {
  if (gran === 'mesi') {
    const [y, m] = p.split('-')
    return `${MESI_SHORT[parseInt(m) - 1]} ${y}`
  }
  if (gran === 'decenni') return `${p.slice(0, 3)}0s`
  return p
}

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
          <span className="text-gray-500 capitalize">{e.name}:</span>
          <span className="font-medium text-gray-800">{e.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Donut shape ───────────────────────────────────────────────────────────────
function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#1f2937" style={{ fontSize: 26, fontWeight: 700 }}>{value}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fill="#6b7280" style={{ fontSize: 13 }}>{payload.name}</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fill="#9ca3af" style={{ fontSize: 11 }}>{(percent * 100).toFixed(0)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 2} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, to }: {
  label: string; value: number; icon: React.ElementType; color: string; to: string
}) {
  return (
    <Link to={to} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-5">
      <div className={`p-4 rounded-xl ${color}`}><Icon size={26} className="text-white" /></div>
      <div>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        <p className="text-gray-500 text-sm mt-0.5">{label}</p>
      </div>
    </Link>
  )
}

// ── Ricerca globale ───────────────────────────────────────────────────────────
function ResultRow({ onClick, badge, badgeColor, title, sub }: {
  onClick: () => void
  badge: string
  badgeColor: string
  title: string
  sub: string
}) {
  return (
    <button
      onMouseDown={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
    >
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>
        {badge}
      </span>
      <span className="flex-1 text-sm text-gray-800 font-medium truncate">{title}</span>
      <span className="text-xs text-gray-400 flex-shrink-0">{sub}</span>
      <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const dq = useDebounce(query.trim(), 280)
  const enabled = dq.length >= 2

  const { data: rb, isFetching: lb } = useQuery({
    queryKey: ['gs-b', dq], enabled,
    queryFn: () => battesimiApi.list({ search: dq, limit: 5 }),
  })
  const { data: rc, isFetching: lc } = useQuery({
    queryKey: ['gs-c', dq], enabled,
    queryFn: () => cresimeApi.list({ search: dq, limit: 5 }),
  })
  const { data: rm, isFetching: lm } = useQuery({
    queryKey: ['gs-m', dq], enabled,
    queryFn: () => matrimoniApi.list({ search: dq, limit: 5 }),
  })

  const loading = lb || lc || lm
  const total = (rb?.length ?? 0) + (rc?.length ?? 0) + (rm?.length ?? 0)
  const showDrop = open && enabled

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const clear = () => { setQuery(''); setOpen(false) }

  return (
    <div ref={ref} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca per nome, cognome, luogo, ministro… (tutti i sacramenti)"
          className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder-gray-400"
        />
        {query && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {showDrop && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
          {loading && total === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Ricerca in corso…</p>
          )}
          {!loading && total === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Nessun risultato per "{dq}"</p>
          )}

          {/* Battesimi */}
          {(rb?.length ?? 0) > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Battesimi</p>
              {rb!.map((b: Battesimo) => (
                <ResultRow
                  key={`b-${b.id}`}
                  onClick={() => { navigate(`/battesimi/${b.id}/modifica`); clear() }}
                  badge="Battesimo"
                  badgeColor="bg-blue-100 text-blue-700"
                  title={`${b.nome} ${b.cognome}`}
                  sub={b.data_battesimo}
                />
              ))}
            </>
          )}

          {/* Cresime */}
          {(rc?.length ?? 0) > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Cresime</p>
              {rc!.map((c: Cresima) => (
                <ResultRow
                  key={`c-${c.id}`}
                  onClick={() => { navigate(`/cresime/${c.id}/modifica`); clear() }}
                  badge="Cresima"
                  badgeColor="bg-amber-100 text-amber-700"
                  title={`${c.nome} ${c.cognome}`}
                  sub={c.data_cresima}
                />
              ))}
            </>
          )}

          {/* Matrimoni */}
          {(rm?.length ?? 0) > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Matrimoni</p>
              {rm!.map((m: Matrimonio) => (
                <ResultRow
                  key={`m-${m.id}`}
                  onClick={() => { navigate(`/matrimoni/${m.id}/modifica`); clear() }}
                  badge="Matrimonio"
                  badgeColor="bg-rose-100 text-rose-700"
                  title={`${m.sposo_nome} ${m.sposo_cognome} + ${m.sposa_nome} ${m.sposa_cognome}`}
                  sub={m.data_matrimonio}
                />
              ))}
            </>
          )}

          {total > 0 && (
            <div className="border-t border-gray-50 px-4 py-2.5 flex gap-4">
              <button onMouseDown={() => { navigate(`/battesimi?search=${dq}`); clear() }}
                className="text-xs text-blue-500 hover:underline">Tutti i battesimi →</button>
              <button onMouseDown={() => { navigate(`/cresime?search=${dq}`); clear() }}
                className="text-xs text-amber-500 hover:underline">Tutte le cresime →</button>
              <button onMouseDown={() => { navigate(`/matrimoni?search=${dq}`); clear() }}
                className="text-xs text-rose-500 hover:underline">Tutti i matrimoni →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Granularity / chart type tabs ─────────────────────────────────────────────
type Gran = 'mesi' | 'anni' | 'decenni'
type ChartType = 'area' | 'bar'

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-gray-500 hover:bg-gray-100'}`}>
      {label}
    </button>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [gran, setGran] = useState<Gran>('anni')
  const [chartType, setChartType] = useState<ChartType>('area')
  const [activeDonut, setActiveDonut] = useState(0)
  const [dal, setDal] = useState('')
  const [al, setAl] = useState('')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', dal, al],
    queryFn: () => statsApi.get({ dal: dal || undefined, al: al || undefined }),
  })

  const total = (stats?.battesimi ?? 0) + (stats?.cresime ?? 0) + (stats?.matrimoni ?? 0)

  const serieRaw: StatsPeriod[] =
    gran === 'mesi'    ? (stats?.per_mese     ?? []) :
    gran === 'decenni' ? (stats?.per_decennio ?? []) :
                         (stats?.per_anno     ?? [])

  const serie = serieRaw.map(d => ({ ...d, label: fmtPeriodo(d.periodo, gran) }))

  const donutData = [
    { name: 'Battesimi', value: stats?.battesimi ?? 0, color: C.battesimi },
    { name: 'Cresime',   value: stats?.cresime   ?? 0, color: C.cresime },
    { name: 'Matrimoni', value: stats?.matrimoni ?? 0, color: C.matrimoni },
  ].filter(d => d.value > 0)

  const hasDateFilter = dal || al

  return (
    <div className="p-8">

      {/* Header + ricerca */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h1>
        <p className="text-gray-500 text-sm mb-5">Panoramica e andamento dei sacramenti registrati</p>
        <GlobalSearch />
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-28 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <StatCard label="Battesimi" value={stats?.battesimi ?? 0} icon={Droplets} color="bg-blue-500"  to="/battesimi" />
          <StatCard label="Cresime"   value={stats?.cresime   ?? 0} icon={Star}     color="bg-amber-500" to="/cresime" />
          <StatCard label="Matrimoni" value={stats?.matrimoni ?? 0} icon={Heart}    color="bg-rose-500"  to="/matrimoni" />
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 rounded-xl bg-indigo-500"><TrendingUp size={26} className="text-white" /></div>
            <div>
              <p className="text-3xl font-bold text-gray-800">{total}</p>
              <p className="text-gray-500 text-sm mt-0.5">
                Totale{hasDateFilter && <span className="text-indigo-500 ml-1">(filtrato)</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grafico principale + Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

        {/* Area / Bar chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* Chart header */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-semibold text-gray-800">Andamento nel tempo</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sacramenti registrati per periodo</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Chart type */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {(['area', 'bar'] as const).map(t => (
                  <button key={t} onClick={() => setChartType(t)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartType === t ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}>
                    {t === 'area' ? 'Area' : 'Barre'}
                  </button>
                ))}
              </div>
              {/* Granularity */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <Tab active={gran === 'mesi'}    label="Mesi"    onClick={() => setGran('mesi')} />
                <Tab active={gran === 'anni'}    label="Anni"    onClick={() => setGran('anni')} />
                <Tab active={gran === 'decenni'} label="Decenni" onClick={() => setGran('decenni')} />
              </div>
            </div>
          </div>

          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <CalendarRange size={15} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 font-medium">Periodo:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Dal</span>
              <input
                type="date"
                value={dal}
                onChange={e => setDal(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Al</span>
              <input
                type="date"
                value={al}
                onChange={e => setAl(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              />
            </div>
            {hasDateFilter && (
              <button onClick={() => { setDal(''); setAl('') }}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 ml-1 font-medium">
                <X size={12} /> Reset
              </button>
            )}
            {hasDateFilter && (
              <span className="ml-auto text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                Filtro attivo
              </span>
            )}
          </div>

          {serie.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
              Nessun dato nel periodo selezionato
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              {chartType === 'area' ? (
                <AreaChart data={serie} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {(['battesimi','cresime','matrimoni'] as const).map(k => (
                      <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C[k]} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={C[k]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="battesimi" stroke={C.battesimi} strokeWidth={2} fill="url(#g-battesimi)" dot={serie.length < 15} />
                  <Area type="monotone" dataKey="cresime"   stroke={C.cresime}   strokeWidth={2} fill="url(#g-cresime)"   dot={serie.length < 15} />
                  <Area type="monotone" dataKey="matrimoni" stroke={C.matrimoni} strokeWidth={2} fill="url(#g-matrimoni)" dot={serie.length < 15} />
                </AreaChart>
              ) : (
                <BarChart data={serie} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="battesimi" fill={C.battesimi} radius={[4,4,0,0]} />
                  <Bar dataKey="cresime"   fill={C.cresime}   radius={[4,4,0,0]} />
                  <Bar dataKey="matrimoni" fill={C.matrimoni} radius={[4,4,0,0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-gray-800">Distribuzione</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {hasDateFilter ? 'Nel periodo filtrato' : 'Composizione del totale'}
            </p>
          </div>
          {donutData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-300 text-sm">Nessun dato</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  {/* @ts-expect-error recharts v3 activeIndex type */}
                  <Pie activeIndex={activeDonut} activeShape={ActiveShape}
                    data={donutData} cx="50%" cy="50%"
                    innerRadius={65} outerRadius={88} dataKey="value"
                    onMouseEnter={(_, i) => setActiveDonut(i)}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-1">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      {d.value}
                      <span className="text-gray-400 font-normal ml-1 text-xs">
                        ({total > 0 ? Math.round(d.value / total * 100) : 0}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Azioni rapide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Aggiungi Battesimo', to: '/battesimi/nuovo', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', icon: Droplets },
          { label: 'Aggiungi Cresima',   to: '/cresime/nuovo',   color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', icon: Star },
          { label: 'Aggiungi Matrimonio',to: '/matrimoni/nuovo', color: 'text-rose-600 bg-rose-50 hover:bg-rose-100',   icon: Heart },
        ].map(({ label, to, color }) => (
          <Link key={to} to={to} className={`flex items-center justify-center gap-2 rounded-xl p-4 font-medium text-sm transition-colors ${color}`}>
            <Plus size={16} /> {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
