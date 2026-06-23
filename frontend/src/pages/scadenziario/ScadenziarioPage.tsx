import { useState, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarDays, Plus, X, Pencil, Trash2, MapPin, RotateCcw, Tag, Settings2 } from 'lucide-react'
import { scadenziarioApi, type Evento } from '../../api/client'
import EventoModal from './EventoModal'
import GestisciCategorie from './GestisciCategorie'

export default function ScadenziarioPage() {
  const qc = useQueryClient()
  const calRef = useRef<FullCalendar>(null)
  const [range, setRange] = useState<{ dal: string; al: string }>({ dal: '', al: '' })
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editEvento, setEditEvento] = useState<Evento | null>(null)
  const [defaultStart, setDefaultStart] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showCategorie, setShowCategorie] = useState(false)

  const { data: categorie = [] } = useQuery({
    queryKey: ['scadenziario-categorie'],
    queryFn: scadenziarioApi.listCategorie,
  })

  const { data: eventi = [] } = useQuery({
    queryKey: ['scadenziario-eventi', range.dal, range.al],
    queryFn: () => scadenziarioApi.listEventi({ dal: range.dal || undefined, al: range.al || undefined }),
    enabled: !!range.dal,
  })

  const deleteMut = useMutation({
    mutationFn: scadenziarioApi.deleteEvento,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scadenziario-eventi'] })
      toast.success('Evento eliminato')
      setShowDetail(false)
      setSelectedEvento(null)
      setDeleteConfirm(false)
    },
    onError: () => toast.error('Errore nella cancellazione'),
  })

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setRange({
      dal: arg.startStr.slice(0, 10),
      al: arg.endStr.slice(0, 10),
    })
  }, [])

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const id = parseInt(arg.event.id.split('-')[0])
    const ev = eventi.find(e => e.id === id)
    if (ev) {
      setSelectedEvento(ev)
      setShowDetail(true)
      setDeleteConfirm(false)
    }
  }, [eventi])

  const handleDateClick = useCallback((arg: DateClickArg) => {
    setDefaultStart(arg.dateStr)
    setEditEvento(null)
    setShowModal(true)
  }, [])

  const fcEvents = eventi.map(ev => ({
    id: `${ev.id}-${ev.occurrence_start || ev.data_inizio}`,
    title: ev.titolo,
    start: ev.occurrence_start || ev.data_inizio,
    end: ev.occurrence_end || ev.data_fine || undefined,
    allDay: ev.tutto_il_giorno,
    color: ev.categoria_colore || '#6366f1',
    extendedProps: { originalId: ev.id },
  }))

  const formatDateTime = (iso?: string, allDay?: boolean) => {
    if (!iso) return ''
    if (allDay) return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    return new Date(iso).toLocaleString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const RICORRENZA_LABELS: Record<string, string> = {
    giornaliera: 'Ogni giorno',
    settimanale: 'Ogni settimana',
    mensile: 'Ogni mese',
    annuale: 'Ogni anno',
  }

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-indigo-600" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Scadenziario</h1>
            <p className="text-gray-500 text-sm">Calendario eventi parrocchiali</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategorie(true)}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Settings2 size={16} />
            Categorie
          </button>
          <button
            onClick={() => { setEditEvento(null); setDefaultStart(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Nuovo evento
          </button>
        </div>
      </div>

      {/* Category legend */}
      {categorie.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {categorie.map(c => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              <span className="w-2 h-2 rounded-full" style={{ background: c.colore }} />
              {c.nome}
            </span>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={itLocale}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
          }}
          events={fcEvents}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          eventDisplay="block"
          height="100%"
          dayMaxEvents={3}
        />
      </div>

      {/* Event detail sidebar */}
      {showDetail && selectedEvento && (
        <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={() => setShowDetail(false)}>
          <div
            className="w-80 bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-gray-800 pr-4">{selectedEvento.titolo}</h2>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            {selectedEvento.categoria_nome && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full w-fit"
                style={{ background: `${selectedEvento.categoria_colore}22`, color: selectedEvento.categoria_colore }}>
                <Tag size={10} />
                {selectedEvento.categoria_nome}
              </span>
            )}

            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-500 text-xs uppercase tracking-wide mb-0.5">Inizio</p>
                <p>{formatDateTime(selectedEvento.occurrence_start || selectedEvento.data_inizio, selectedEvento.tutto_il_giorno)}</p>
              </div>
              {selectedEvento.data_fine && (
                <div>
                  <p className="font-medium text-gray-500 text-xs uppercase tracking-wide mb-0.5">Fine</p>
                  <p>{formatDateTime(selectedEvento.occurrence_end || selectedEvento.data_fine, selectedEvento.tutto_il_giorno)}</p>
                </div>
              )}
              {selectedEvento.luogo && (
                <div className="flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{selectedEvento.luogo}</span>
                </div>
              )}
              {selectedEvento.ricorrenza && (
                <div className="flex items-start gap-1.5">
                  <RotateCcw size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{RICORRENZA_LABELS[selectedEvento.ricorrenza] || selectedEvento.ricorrenza}
                    {selectedEvento.ricorrenza_fine && ` fino al ${new Date(selectedEvento.ricorrenza_fine).toLocaleDateString('it-IT')}`}
                  </span>
                </div>
              )}
              {selectedEvento.descrizione && (
                <div>
                  <p className="font-medium text-gray-500 text-xs uppercase tracking-wide mb-0.5">Descrizione</p>
                  <p className="whitespace-pre-wrap">{selectedEvento.descrizione}</p>
                </div>
              )}
              {selectedEvento.note && (
                <div>
                  <p className="font-medium text-gray-500 text-xs uppercase tracking-wide mb-0.5">Note</p>
                  <p className="whitespace-pre-wrap text-gray-500">{selectedEvento.note}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
              <button
                onClick={() => { setEditEvento(selectedEvento); setShowDetail(false); setShowModal(true) }}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil size={14} /> Modifica
              </button>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} /> Elimina
                </button>
              ) : (
                <button
                  onClick={() => deleteMut.mutate(selectedEvento.id)}
                  disabled={deleteMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  <Trash2 size={14} /> Conferma
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <EventoModal
          evento={editEvento}
          defaultStart={defaultStart}
          categorie={categorie}
          onClose={() => { setShowModal(false); setEditEvento(null) }}
          onSaved={() => {
            setShowModal(false)
            setEditEvento(null)
            qc.invalidateQueries({ queryKey: ['scadenziario-eventi'] })
          }}
        />
      )}

      {/* Gestisci categorie modal */}
      {showCategorie && (
        <GestisciCategorie onClose={() => setShowCategorie(false)} />
      )}
    </div>
  )
}
