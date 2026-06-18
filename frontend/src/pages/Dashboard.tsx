import { useQuery } from '@tanstack/react-query'
import { Droplets, Star, Heart, TrendingUp } from 'lucide-react'
import { statsApi } from '../api/client'
import { Link } from 'react-router-dom'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  to,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-5"
    >
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon size={28} className="text-white" />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        <p className="text-gray-500 text-sm mt-0.5">{label}</p>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
  })

  const total = (stats?.battesimi ?? 0) + (stats?.cresime ?? 0) + (stats?.matrimoni ?? 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Panoramica dei sacramenti registrati</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard label="Battesimi" value={stats?.battesimi ?? 0} icon={Droplets} color="bg-blue-500" to="/battesimi" />
          <StatCard label="Cresime" value={stats?.cresime ?? 0} icon={Star} color="bg-amber-500" to="/cresime" />
          <StatCard label="Matrimoni" value={stats?.matrimoni ?? 0} icon={Heart} color="bg-rose-500" to="/matrimoni" />
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="p-4 rounded-xl bg-indigo-500">
              <TrendingUp size={28} className="text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-800">{total}</p>
              <p className="text-gray-500 text-sm mt-0.5">Totale sacramenti</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Aggiungi Battesimo', to: '/battesimi/nuovo', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
          { label: 'Aggiungi Cresima', to: '/cresime/nuovo', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
          { label: 'Aggiungi Matrimonio', to: '/matrimoni/nuovo', color: 'text-rose-600 bg-rose-50 hover:bg-rose-100' },
        ].map(({ label, to, color }) => (
          <Link
            key={to}
            to={to}
            className={`rounded-xl p-5 font-medium text-center transition-colors ${color}`}
          >
            + {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
