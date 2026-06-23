import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { scadenziarioApi, type Evento, type CategoriaEvento } from '../../api/client'

interface Props {
  evento: Evento | null
  defaultStart: string | null
  categorie: CategoriaEvento[]
  onClose: () => void
  onSaved: () => void
}

const RICORRENZE = [
  { value: '', label: 'Nessuna' },
  { value: 'giornaliera', label: 'Giornaliera' },
  { value: 'settimanale', label: 'Settimanale' },
  { value: 'mensile', label: 'Mensile' },
  { value: 'annuale', label: 'Annuale' },
]

function toLocalDatetimeInput(iso?: string | null): string {
  if (!iso) return ''
  // Convert ISO to local datetime-local input format (YYYY-MM-DDTHH:MM)
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventoModal({ evento, defaultStart, categorie, onClose, onSaved }: Props) {
  const isEdit = !!evento

  const [form, setForm] = useState({
    titolo: '',
    descrizione: '',
    data_inizio: '',
    data_fine: '',
    tutto_il_giorno: false,
    luogo: '',
    categoria_id: '' as string | number,
    ricorrenza: '',
    ricorrenza_fine: '',
    note: '',
  })

  useEffect(() => {
    if (evento) {
      setForm({
        titolo: evento.titolo,
        descrizione: evento.descrizione || '',
        data_inizio: toLocalDatetimeInput(evento.data_inizio),
        data_fine: toLocalDatetimeInput(evento.data_fine),
        tutto_il_giorno: evento.tutto_il_giorno,
        luogo: evento.luogo || '',
        categoria_id: evento.categoria_id ?? '',
        ricorrenza: evento.ricorrenza || '',
        ricorrenza_fine: evento.ricorrenza_fine || '',
        note: evento.note || '',
      })
    } else if (defaultStart) {
      // defaultStart may be 'YYYY-MM-DD' (all-day click) or 'YYYY-MM-DDTHH:MM:SS'
      const dt = defaultStart.length === 10 ? `${defaultStart}T09:00` : defaultStart.slice(0, 16)
      setForm(f => ({ ...f, data_inizio: dt, data_fine: '' }))
    }
  }, [evento, defaultStart])

  const createMut = useMutation({
    mutationFn: (d: Parameters<typeof scadenziarioApi.createEvento>[0]) => scadenziarioApi.createEvento(d),
    onSuccess: () => { toast.success('Evento creato'); onSaved() },
    onError: () => toast.error('Errore nella creazione'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Parameters<typeof scadenziarioApi.updateEvento>[1] }) =>
      scadenziarioApi.updateEvento(id, d),
    onSuccess: () => { toast.success('Evento aggiornato'); onSaved() },
    onError: () => toast.error("Errore nell'aggiornamento"),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      titolo: form.titolo,
      descrizione: form.descrizione || undefined,
      data_inizio: form.data_inizio ? new Date(form.data_inizio).toISOString() : new Date().toISOString(),
      data_fine: form.data_fine ? new Date(form.data_fine).toISOString() : undefined,
      tutto_il_giorno: form.tutto_il_giorno,
      luogo: form.luogo || undefined,
      categoria_id: form.categoria_id ? Number(form.categoria_id) : undefined,
      ricorrenza: form.ricorrenza || undefined,
      ricorrenza_fine: form.ricorrenza_fine || undefined,
      note: form.note || undefined,
    }
    if (isEdit && evento) {
      updateMut.mutate({ id: evento.id, d: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{isEdit ? 'Modifica evento' : 'Nuovo evento'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titolo *</label>
            <input type="text" value={form.titolo} onChange={set('titolo')} required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="tutto_il_giorno" checked={form.tutto_il_giorno}
              onChange={e => setForm(f => ({ ...f, tutto_il_giorno: e.target.checked }))}
              className="rounded border-gray-300 text-indigo-600" />
            <label htmlFor="tutto_il_giorno" className="text-sm text-gray-700">Tutto il giorno</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Inizio *</label>
              <input
                type={form.tutto_il_giorno ? 'date' : 'datetime-local'}
                value={form.tutto_il_giorno ? form.data_inizio.slice(0,10) : form.data_inizio}
                onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fine</label>
              <input
                type={form.tutto_il_giorno ? 'date' : 'datetime-local'}
                value={form.tutto_il_giorno ? form.data_fine.slice(0,10) : form.data_fine}
                onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Luogo</label>
            <input type="text" value={form.luogo} onChange={set('luogo')} placeholder="Es. Chiesa principale"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
            <select value={form.categoria_id} onChange={set('categoria_id')}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">— Nessuna categoria —</option>
              {categorie.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ricorrenza</label>
              <select value={form.ricorrenza} onChange={set('ricorrenza')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {RICORRENZE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {form.ricorrenza && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fine ricorrenza</label>
                <input type="date" value={form.ricorrenza_fine} onChange={set('ricorrenza_fine')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione</label>
            <textarea value={form.descrizione} onChange={set('descrizione')} rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
            <textarea value={form.note} onChange={set('note')} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Annulla
            </button>
            <button type="submit" disabled={isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {isPending ? 'Salvataggio...' : isEdit ? 'Salva modifiche' : 'Crea evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
