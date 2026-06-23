import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Droplets, Star, Heart, Search, X,
  ArrowRight, CalendarRange, Users, RotateCcw, GripVertical,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts'
import ReactGridLayout, { WidthProvider, Responsive } from 'react-grid-layout'
const RGL = WidthProvider(Responsive)
type Layouts = ReactGridLayout.Layouts
type Layout = ReactGridLayout.Layout
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  statsApi, battesimiApi, cresimeApi, matrimoniApi, dashboardApi,
  type StatsPeriod, type Battesimo, type Cresima, type Matrimonio,
} from '../api/client'
import ProssimiEventiWidget from './dashboard/ProssimiEventiWidget'
import ContabilitaMeseWidget from './dashboard/ContabilitaMeseWidget'

// ── Colours ───────────────────────────────────────────────────────────────────
const C = { battesimi: '#3b82f6', cresime: '#f59e0b', matrimoni: '#f43f5e' }

// ── Debounce ─────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t) }, [value, delay])
  return d
}

// ── Active donut shape ────────────────────────────────────────────────────────
const ActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill={fill} style={{ fontSize: 22, fontWeight: 700 }}>{value}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#9ca3af" style={{ fontSize: 12 }}>{payload.name}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill="#9ca3af" style={{ fontSize: 11 }}>{(percent * 100).toFixed(0)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 1} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}

// ── Default layout ────────────────────────────────────────────────────────────
const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: 'stats',  x: 0,  y: 0, w: 12, h: 2, minH: 2, maxH: 2, isResizable: false },
    { i: 'chart',  x: 0,  y: 2, w: 8,  h: 5, minH: 4 },
    { i: 'donut',  x: 8,  y: 2, w: 4,  h: 5, minH: 4 },
    { i: 'eventi', x: 0,  y: 7, w: 5,  h: 5, minH: 3 },
    { i: 'contab', x: 5,  y: 7, w: 4,  h: 5, minH: 4, maxH: 5 },
    { i: 'azioni', x: 9,  y: 7, w: 3,  h: 5, minH: 3 },
  ],
  md: [
    { i: 'stats',  x: 0, y: 0,  w: 10, h: 2 },
    { i: 'chart',  x: 0, y: 2,  w: 6,  h: 5 },
    { i: 'donut',  x: 6, y: 2,  w: 4,  h: 5 },
    { i: 'eventi', x: 0, y: 7,  w: 5,  h: 5 },
    { i: 'contab', x: 5, y: 7,  w: 5,  h: 5 },
    { i: 'azioni', x: 0, y: 12, w: 10, h: 3 },
  ],
  sm: [
    { i: 'stats',  x: 0, y: 0,  w: 6, h: 4 },
    { i: 'chart',  x: 0, y: 4,  w: 6, h: 5 },
    { i: 'donut',  x: 0, y: 9,  w: 6, h: 5 },
    { i: 'eventi', x: 0, y: 14, w: 6, h: 5 },
    { i: 'contab', x: 0, y: 19, w: 6, h: 5 },
    { i: 'azioni', x: 0, y: 24, w: 6, h: 3 },
  ],
}

const LAYOUT_KEY = 'rechurch_dashboard_layout'

function loadLayouts(): Layouts {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUTS
  } catch {
    return DEFAULT_LAYOUTS
  }
}

// ── Widget wrapper ────────────────────────────────────────────────────────────
function Widget({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-full flex flex-col ${className}`}>
      {children}
    </div>
  )
}

// ── GlobalSearch ──────────────────────────────────────────────────────────────
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
    <div ref={ref} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm">
        <Search size={15} className="text-gray-400 flex-shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca sacramenti…"
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
        />
        {query && <button onClick={clear}><X size={14} className="text-gray-400 hover:text-gray-600" /></button>}
      </div>

      {showDrop && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-96 overflow-y-auto">
          {loading && total === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Ricerca in corso…</p>
          )}
          {!loading && total === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Nessun risultato per "{dq}"</p>
          )}

          {(rb?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100"
                style={{ borderLeft: `3px solid ${C.battesimi}` }}>Battesimi</div>
              {rb!.map((b: Battesimo) => (
                <button key={b.id} onMouseDown={() => { navigate(`/battesimi/${b.id}/modifica`); clear() }}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between group">
                  <span className="text-sm text-gray-800">{b.nome} {b.cognome}</span>
                  <span className="text-xs text-gray-400 group-hover:text-indigo-400">{b.data_battesimo}</span>
                </button>
              ))}
            </div>
          )}

          {(rc?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100"
                style={{ borderLeft: `3px solid ${C.cresime}` }}>Cresime</div>
              {rc!.map((c: Cresima) => (
                <button key={c.id} onMouseDown={() => { navigate(`/cresime/${c.id}/modifica`); clear() }}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between group">
                  <span className="text-sm text-gray-800">{c.nome} {c.cognome}</span>
                  <span className="text-xs text-gray-400 group-hover:text-indigo-400">{c.data_cresima}</span>
                </button>
              ))}
            </div>
          )}

          {(rm?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100"
                style={{ borderLeft: `3px solid ${C.matrimoni}` }}>Matrimoni</div>
              {rm!.map((m: Matrimonio) => (
                <button key={m.id} onMouseDown={() => { navigate(`/matrimoni/${m.id}/modifica`); clear() }}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between group">
                  <span className="text-sm text-gray-800">{m.sposo_cognome} &amp; {m.sposa_cognome}</span>
                  <span className="text-xs text-gray-400 group-hover:text-indigo-400">{m.data_matrimonio}</span>
                </button>
              ))}
            </div>
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

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [granularity, setGranularity] = useState<'mesi' | 'anni' | 'decenni'>('anni')
  const [chartType, setChartType] = useState<'area' | 'bar'>('area')
  const [dal, setDal] = useState('')
  const [al, setAl] = useState('')
  const [activeDonut, setActiveDonut] = useState(0)
  const [layouts, setLayouts] = useState<Layouts>(loadLayouts)

  const hasDateFilter = !!(dal || al)

  const { data: stats } = useQuery({
    queryKey: ['stats', dal, al],
    queryFn: () => statsApi.get({ dal: dal || undefined, al: al || undefined }),
  })

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.summary,
    staleTime: 60_000,
  })

  const chartData: StatsPeriod[] = granularity === 'mesi'
    ? (stats?.per_mese ?? [])
    : granularity === 'decenni'
    ? (stats?.per_decennio ?? [])
    : (stats?.per_anno ?? [])

  const donutData = [
    { name: 'Battesimi', value: stats?.battesimi ?? 0, color: C.battesimi },
    { name: 'Cresime',   value: stats?.cresime ?? 0,   color: C.cresime },
    { name: 'Matrimoni', value: stats?.matrimoni ?? 0, color: C.matrimoni },
  ]
  const total = donutData.reduce((s, d) => s + d.value, 0)

  function resetLayout() {
    setLayouts(DEFAULT_LAYOUTS)
    localStorage.removeItem(LAYOUT_KEY)
  }

  function handleLayoutChange(_current: Layout[], allLayouts: Layouts) {
    setLayouts(allLayouts)
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(allLayouts))
  }

  // ── Stats widget content ──────────────────────────────────────────────────
  const statsContent = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
      {[
        { label: 'Battesimi', value: summary?.sacramenti.battesimi ?? stats?.battesimi ?? 0, color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Droplets, to: '/battesimi' },
        { label: 'Cresime',   value: summary?.sacramenti.cresime   ?? stats?.cresime   ?? 0, color: 'text-amber-600', bg: 'bg-amber-50',  icon: Star,     to: '/cresime' },
        { label: 'Matrimoni', value: summary?.sacramenti.matrimoni ?? stats?.matrimoni ?? 0, color: 'text-rose-600',  bg: 'bg-rose-50',   icon: Heart,    to: '/matrimoni' },
        { label: 'Persone',   value: summary?.persone ?? 0,                                  color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Users,    to: '/rubrica' },
      ].map(({ label, value, color, bg, icon: Icon, to }) => (
        <Link key={label} to={to}
          className={`${bg} rounded-xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity`}>
          <div className={`${color} ${bg} rounded-lg p-2`}>
            <Icon size={20} className={color} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{value.toLocaleString('it-IT')}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </Link>
      ))}
    </div>
  )

  // ── Chart widget content ──────────────────────────────────────────────────
  const chartContent = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            {(['mesi', 'anni', 'decenni'] as const).map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 font-medium transition-colors ${granularity === g ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            <button onClick={() => setChartType('area')} className={`px-3 py-1.5 font-medium ${chartType === 'area' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Area</button>
            <button onClick={() => setChartType('bar')}  className={`px-3 py-1.5 font-medium ${chartType === 'bar'  ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Barre</button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CalendarRange size={14} className="text-gray-400" />
          <input type="date" value={dal} onChange={e => setDal(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <span className="text-gray-400">—</span>
          <input type="date" value={al} onChange={e => setAl(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          {hasDateFilter && (
            <button onClick={() => { setDal(''); setAl('') }}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Rimuovi filtro">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                {(['battesimi', 'cresime', 'matrimoni'] as const).map(k => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C[k]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C[k]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {(['battesimi', 'cresime', 'matrimoni'] as const).map(k => (
                <Area key={k} type="monotone" dataKey={k} name={k.charAt(0).toUpperCase() + k.slice(1)}
                  stroke={C[k]} fill={`url(#grad-${k})`} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {(['battesimi', 'cresime', 'matrimoni'] as const).map(k => (
                <Bar key={k} dataKey={k} name={k.charAt(0).toUpperCase() + k.slice(1)}
                  fill={C[k]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )

  // ── Donut widget content ──────────────────────────────────────────────────
  const donutContent = (
    <div className="h-full flex flex-col">
      <div className="mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">Distribuzione</h3>
        <p className="text-xs text-gray-400 mt-0.5">{hasDateFilter ? 'Nel periodo filtrato' : 'Totale complessivo'}</p>
      </div>
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Nessun dato</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              {/* @ts-expect-error recharts v3 activeIndex type */}
              <Pie activeIndex={activeDonut} activeShape={ActiveShape}
                data={donutData} cx="50%" cy="50%"
                innerRadius={55} outerRadius={78} dataKey="value"
                onMouseEnter={(_: unknown, i: number) => setActiveDonut(i)}>
                {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-1">
            {donutData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-gray-600 text-xs">{d.name}</span>
                </div>
                <span className="font-semibold text-gray-800 text-sm">
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
  )

  // ── Azioni rapide ─────────────────────────────────────────────────────────
  const azioniContent = (
    <div className="h-full flex flex-col">
      <h3 className="font-semibold text-gray-800 text-sm mb-3">Azioni rapide</h3>
      <div className="space-y-2 flex-1">
        {[
          { label: 'Battesimo',  to: '/battesimi/nuovo',         color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',     icon: Droplets },
          { label: 'Cresima',    to: '/cresime/nuovo',           color: 'text-amber-600 bg-amber-50 hover:bg-amber-100',  icon: Star },
          { label: 'Matrimonio', to: '/matrimoni/nuovo',         color: 'text-rose-600 bg-rose-50 hover:bg-rose-100',     icon: Heart },
          { label: 'Persona',    to: '/rubrica/persone/nuova',   color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', icon: Users },
        ].map(({ label, to, color, icon: Icon }) => (
          <Link key={to} to={to} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${color}`}>
            <Icon size={16} /> <span>Nuovo {label}</span>
            <ArrowRight size={14} className="ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Panoramica parrocchiale</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <GlobalSearch />
          <button onClick={resetLayout} title="Ripristina layout"
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Draggable grid */}
      <RGL
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
        cols={{ lg: 12, md: 10, sm: 6 }}
        rowHeight={60}
        margin={[16, 16]}
        draggableHandle=".drag-handle"
        isResizable={true}
      >
        <div key="stats">
          <Widget>{statsContent}</Widget>
        </div>

        <div key="chart">
          <Widget>
            <div className="drag-handle flex items-center gap-2 mb-2 cursor-grab active:cursor-grabbing">
              <GripVertical size={14} className="text-gray-300" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Andamento</span>
            </div>
            {chartContent}
          </Widget>
        </div>

        <div key="donut">
          <Widget>
            <div className="drag-handle flex items-center gap-2 mb-1 cursor-grab active:cursor-grabbing">
              <GripVertical size={14} className="text-gray-300" />
            </div>
            {donutContent}
          </Widget>
        </div>

        <div key="eventi">
          <Widget>
            <div className="drag-handle flex items-center gap-2 mb-1 cursor-grab active:cursor-grabbing">
              <GripVertical size={14} className="text-gray-300" />
            </div>
            <ProssimiEventiWidget />
          </Widget>
        </div>

        <div key="contab">
          <Widget>
            <div className="drag-handle flex items-center gap-2 mb-1 cursor-grab active:cursor-grabbing">
              <GripVertical size={14} className="text-gray-300" />
            </div>
            <ContabilitaMeseWidget />
          </Widget>
        </div>

        <div key="azioni">
          <Widget>
            <div className="drag-handle flex items-center gap-2 mb-1 cursor-grab active:cursor-grabbing">
              <GripVertical size={14} className="text-gray-300" />
            </div>
            {azioniContent}
          </Widget>
        </div>
      </RGL>
    </div>
  )
}
