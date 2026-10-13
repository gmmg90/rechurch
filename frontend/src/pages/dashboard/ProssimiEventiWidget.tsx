import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, ArrowRight } from 'lucide-react'
import { scadenziarioApi, type Evento } from '../../api/client'

function formatEventDate(ev: Evento): string {
  const d = new Date(ev.occurrence_start || ev.data_inizio)
  if (ev.tutto_il_giorno) {
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })
  }
  return d.toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ProssimiEventiWidget() {
  const { data: eventi = [], isLoading } = useQuery({
    queryKey: ['prossimi-eventi-dashboard'],
    queryFn: () => scadenziarioApi.prossimiEventi(30),
    staleTime: 60_000,
  })

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-indigo-500" size={18} />
          <h3 className="font-semibold text-gray-800 text-sm">Prossimi eventi</h3>
        </div>
        <Link to="/scadenziario" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
          Vai <ArrowRight size={12} />
        </Link>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Caricamento...</div>
      ) : eventi.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">Nessun evento nei prossimi 30 giorni</div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1">
          {eventi.slice(0, 8).map((ev, i) => (
            <div key={`${ev.id}-${i}`} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                style={{ background: ev.categoria_colore || '#6366f1' }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{ev.titolo}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatEventDate(ev)}</p>
                {ev.luogo && <p className="text-xs text-gray-400 truncate">{ev.luogo}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
