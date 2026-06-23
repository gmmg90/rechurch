import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { contabilitaApi } from '../../api/client'

const today = () => new Date().toISOString().split('T')[0]

interface FormState {
  data: string
  tipo: 'entrata' | 'uscita'
  importo: string
  descrizione: string
  categoria_id: string
  fornitore_id: string
  numero_documento: string
  metodo_pagamento: string
  note: string
}

const emptyForm = (): FormState => ({
  data: today(),
  tipo: 'entrata',
  importo: '',
  descrizione: '',
  categoria_id: '',
  fornitore_id: '',
  numero_documento: '',
  metodo_pagamento: '',
  note: '',
})

export default function MovimentoForm() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<FormState>(emptyForm())

  // Load existing movimento for edit
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['movimento', id],
    queryFn: () => contabilitaApi.getMovimento(Number(id)),
    enabled: isEdit,
  })

  // Load all categories (unfiltered — we filter client-side by tipo)
  const { data: allCategorie = [] } = useQuery({
    queryKey: ['categorie'],
    queryFn: () => contabilitaApi.listCategorie(),
  })

  const { data: fornitori = [] } = useQuery({
    queryKey: ['fornitori'],
    queryFn: () => contabilitaApi.listFornitori(),
  })

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setForm({
        data: existing.data,
        tipo: existing.tipo,
        importo: String(existing.importo),
        descrizione: existing.descrizione,
        categoria_id: existing.categoria_id ? String(existing.categoria_id) : '',
        fornitore_id: existing.fornitore_id ? String(existing.fornitore_id) : '',
        numero_documento: existing.numero_documento || '',
        metodo_pagamento: existing.metodo_pagamento || '',
        note: existing.note || '',
      })
    }
  }, [existing])

  const categorieFiltered = allCategorie.filter(c => c.tipo === form.tipo)

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        data: form.data,
        tipo: form.tipo,
        importo: parseFloat(form.importo),
        descrizione: form.descrizione,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : undefined,
        fornitore_id: form.fornitore_id ? Number(form.fornitore_id) : undefined,
        numero_documento: form.numero_documento || undefined,
        metodo_pagamento: form.metodo_pagamento || undefined,
        note: form.note || undefined,
      }
      if (isEdit) {
        return contabilitaApi.updateMovimento(Number(id), payload)
      }
      return contabilitaApi.createMovimento(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimenti'] })
      qc.invalidateQueries({ queryKey: ['contabilita-riepilogo'] })
      toast.success(isEdit ? 'Movimento aggiornato' : 'Movimento creato')
      navigate('/contabilita')
    },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleTipoChange = (t: 'entrata' | 'uscita') => {
    setForm(f => ({ ...f, tipo: t, categoria_id: '' }))
  }

  const isValid = form.data && form.importo && parseFloat(form.importo) > 0 && form.descrizione.trim()

  if (isEdit && loadingExisting) {
    return <div className="p-8 text-gray-400">Caricamento...</div>
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/contabilita')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <Wallet className="text-indigo-600" size={24} />
          <h1 className="text-2xl font-bold text-gray-800">
            {isEdit ? 'Modifica Movimento' : 'Nuovo Movimento'}
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

        {/* Data + Tipo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.data}
              onChange={set('data')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => handleTipoChange('entrata')}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  form.tipo === 'entrata'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Entrata
              </button>
              <button
                type="button"
                onClick={() => handleTipoChange('uscita')}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  form.tipo === 'uscita'
                    ? 'bg-red-500 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Uscita
              </button>
            </div>
          </div>
        </div>

        {/* Importo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Importo (€) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="0,00"
              value={form.importo}
              onChange={set('importo')}
            />
          </div>
        </div>

        {/* Descrizione */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Breve descrizione del movimento"
            value={form.descrizione}
            onChange={set('descrizione')}
          />
        </div>

        {/* Categoria + Fornitore */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.categoria_id}
              onChange={set('categoria_id')}
            >
              <option value="">— Nessuna —</option>
              {categorieFiltered.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornitore</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.fornitore_id}
              onChange={set('fornitore_id')}
            >
              <option value="">— Nessuno —</option>
              {fornitori.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* N° Documento + Metodo Pagamento */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° Documento</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Fattura, ricevuta..."
              value={form.numero_documento}
              onChange={set('numero_documento')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metodo Pagamento</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.metodo_pagamento}
              onChange={set('metodo_pagamento')}
            >
              <option value="">—</option>
              <option value="contanti">Contanti</option>
              <option value="bonifico">Bonifico</option>
              <option value="carta">Carta</option>
              <option value="assegno">Assegno</option>
            </select>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            rows={3}
            placeholder="Note aggiuntive..."
            value={form.note}
            onChange={set('note')}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 justify-end">
          <button
            type="button"
            onClick={() => navigate('/contabilita')}
            className="px-5 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!isValid || save.isPending}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {save.isPending ? 'Salvataggio...' : isEdit ? 'Aggiorna' : 'Crea Movimento'}
          </button>
        </div>
      </div>
    </div>
  )
}
