import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Wallet, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { dashboardApi } from '../../api/client'

const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

export default function ContabilitaMeseWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.summary,
    staleTime: 60_000,
  })

  const c = data?.contabilita_mese

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="text-emerald-500" size={18} />
          <h3 className="font-semibold text-gray-800 text-sm">Contabilità — {c?.mese || '…'}</h3>
        </div>
        <Link to="/contabilita" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
          Vai <ArrowRight size={12} />
        </Link>
      </div>
      {isLoading || !c ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Caricamento...</div>
      ) : (
        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600" />
              <span className="text-sm text-green-700 font-medium">Entrate</span>
            </div>
            <span className="font-bold text-green-700">{fmt(c.entrate)}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-red-600" />
              <span className="text-sm text-red-700 font-medium">Uscite</span>
            </div>
            <span className="font-bold text-red-700">{fmt(c.uscite)}</span>
          </div>
          <div className={`flex items-center justify-between p-3 rounded-xl ${c.saldo >= 0 ? 'bg-indigo-50' : 'bg-orange-50'}`}>
            <span className={`text-sm font-medium ${c.saldo >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>Saldo</span>
            <span className={`font-bold text-lg ${c.saldo >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>{fmt(c.saldo)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
