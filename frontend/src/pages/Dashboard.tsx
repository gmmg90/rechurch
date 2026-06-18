import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Droplets, Star, Heart, TrendingUp, Plus } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts'
import { statsApi, type StatsPeriod } from '../api/client'

// ── Colori ────────────────────────────────────────────────────────────────────
const C = {
  battesimi: '#3b82f6',
  cresime:   '#f59e0b',
  matrimoni: '#f43f5e',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

function fmtPeriodo(p: string, granularity: string): string {
  if (granularity === 'mesi') {
    const [y, m] = p.split('-')
    return `${MESI_SHORT[parseInt(m) - 1]} ${y}`
  }
  if (granularity === 'decenni') return `anni ${p.slice(0, 3)}0`
  return p
}

// ── Tooltip personalizzato ─────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: e.color }} />
          <span className="text-gray-500 capitalize">{e.name}:</span>
          <span className="font-medium text-gray-800">{e.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Donut attivo ───────────────────────────────────────────────────────────
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#1f2937" className="text-lg font-bold" style={{ fontSize: 26, fontWeight: 700 }}>
        {value}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fill="#6b7280" style={{ fontSize: 13 }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 36} textAnchor="middle" fill="#9ca3af" style={{ fontSize: 11 }}>
        {(percent * 100).toFixed(0)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 2}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, to }: {
  label: string; value: number; icon: React.ElementType; color: string; to: string
}) {
  return (
    <Link to={to} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-5">
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon size={26} className="text-white" />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        <p className="text-gray-500 text-sm mt-0.5">{label}</p>
      </div>
    </Link>
  )
}

// ── Granularity tab ────────────────────────────────────────────────────────
type Granularity = 'mesi' | 'anni' | 'decenni'

function GranTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )
}

// ── Chart tipo toggle ──────────────────────────────────────────────────────
type ChartType = 'area' | 'bar'

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [gran, setGran] = useState<Granularity>('anni')
  const [chartType, setChartType] = useState<ChartType>('area')
  const [activeDonut, setActiveDonut] = useState(0)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
  })

  const total = (stats?.battesimi ?? 0) + (stats?.cresime ?? 0) + (stats?.matrimoni ?? 0)

  const serieRaw: StatsPeriod[] =
    gran === 'mesi'     ? (stats?.per_mese     ?? []) :
    gran === 'decenni'  ? (stats?.per_decennio ?? []) :
                          (stats?.per_anno     ?? [])

  const serie = serieRaw.map(d => ({
    ...d,
    label: fmtPeriodo(d.periodo, gran),
  }))

  const donutData = [
    { name: 'Battesimi', value: stats?.battesimi ?? 0, color: C.battesimi },
    { name: 'Cresime',   value: stats?.cresime   ?? 0, color: C.cresime },
    { name: 'Matrimoni', value: stats?.matrimoni  ?? 0, color: C.matrimoni },
  ].filter(d => d.value > 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Panoramica e andamento dei sacramenti registrati</p>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <StatCard label="Battesimi" value={stats?.battesimi ?? 0} icon={Droplets} color="bg-blue-500"   to="/battesimi" />
          <StatCard label="Cresime"   value={stats?.cresime   ?? 0} icon={Star}     color="bg-amber-500"  to="/cresime" />
          <StatCard label="Matrimoni" value={stats?.matrimoni ?? 0} icon={Heart}    color="bg-rose-500"   to="/matrimoni" />
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 rounded-xl bg-indigo-500">
              <TrendingUp size={26} className="text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-800">{total}</p>
              <p className="text-gray-500 text-sm mt-0.5">Totale sacramenti</p>
            </div>
          </div>
        </div>
      )}

      {/* Grafico principale + Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

        {/* Area / Bar chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-800">Andamento nel tempo</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sacramenti registrati per periodo</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Chart type */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setChartType('area')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartType === 'area' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}
                >
                  Area
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartType === 'bar' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}
                >
                  Barre
                </button>
              </div>
              {/* Granularity */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <GranTab active={gran === 'mesi'}    label="Mesi"     onClick={() => setGran('mesi')} />
                <GranTab active={gran === 'anni'}    label="Anni"     onClick={() => setGran('anni')} />
                <GranTab active={gran === 'decenni'} label="Decenni"  onClick={() => setGran('decenni')} />
              </div>
            </div>
          </div>

          {serie.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
              Nessun dato disponibile
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              {chartType === 'area' ? (
                <AreaChart data={serie} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {(['battesimi','cresime','matrimoni'] as const).map(k => (
                      <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="battesimi" stroke={C.battesimi} strokeWidth={2} fill={`url(#grad-battesimi)`} dot={serie.length < 15} />
                  <Area type="monotone" dataKey="cresime"   stroke={C.cresime}   strokeWidth={2} fill={`url(#grad-cresime)`}   dot={serie.length < 15} />
                  <Area type="monotone" dataKey="matrimoni" stroke={C.matrimoni} strokeWidth={2} fill={`url(#grad-matrimoni)`} dot={serie.length < 15} />
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
            <p className="text-xs text-gray-400 mt-0.5">Composizione del totale</p>
          </div>

          {donutData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
              Nessun dato
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    activeIndex={activeDonut}
                    activeShape={renderActiveShape}
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={90}
                    dataKey="value"
                    onMouseEnter={(_, i) => setActiveDonut(i)}
                  >
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={d.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Legenda manuale */}
              <div className="flex flex-col gap-2 mt-2">
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
        ].map(({ label, to, color, icon: Icon }) => (
          <Link key={to} to={to} className={`flex items-center justify-center gap-2 rounded-xl p-4 font-medium text-sm transition-colors ${color}`}>
            <Plus size={16} />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
