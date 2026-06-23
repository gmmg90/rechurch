import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wallet, Paperclip, X, Download, FileText, Image } from 'lucide-react'
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

function fileIcon(nome: string) {
  const ext = nome.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) return <Image size={16} />
  return <FileText size={16} />
}

export default function MovimentoForm() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<FormState>(emptyForm())
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['movimento', id],
    queryFn: () => contabilitaApi.getMovimento(Number(id)),
    enabled: isEdit,
  })

  const { data: allCategorie = [] } = useQuery({
    queryKey: ['categorie'],
    queryFn: () => contabilitaApi.listCategorie(),
  })

  const { data: fornitori = [] } = useQuery({
    queryKey: ['fornitori'],
    queryFn: () => contabilitaApi.listFornitori(),
  })

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

  const delAllegato = useMutation({
    mutationFn: () => contabilitaApi.deleteAllegato(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimento', id] })
      toast.success('Allegato rimosso')
    },
    onError: () => toast.error('Errore nella rimozione'),
  })

  const save = useMutation({
    mutationFn: async () => {
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
      let saved
      if (isEdit) {
        saved = await contabilitaApi.updateMovimento(Number(id), payload)
      } else {
        saved = await contabilitaApi.createMovimento(payload)
      }
      if (pendingFile) {
        await contabilitaApi.uploadAllegato(saved.id, pendingFile)
      }
      return saved
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

  const handleFileSelect = (file: File) => {
    const MAX = 10 * 1024 * 1024
    if (file.size > MAX) { toast.error('File troppo grande (max 10 MB)'); return }
    setPendingFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const isValid = form.data && form.importo && parseFloat(form.importo) > 0 && form.descrizione.trim()
  const hasExistingAllegato = isEdit && existing?.allegato_nome

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

        {/* ── Allegato ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Allegato</label>

          {/* Allegato esistente (solo in modifica) */}
          {hasExistingAllegato && !pendingFile && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg mb-3">
              <span className="text-indigo-500">{fileIcon(existing.allegato_nome!)}</span>
              <span className="text-sm text-indigo-800 flex-1 truncate">{existing.allegato_nome}</span>
              <a
                href={contabilitaApi.getAllegatoUrl(Number(id))}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                title="Scarica"
              >
                <Download size={15} />
              </a>
              <button
                type="button"
                onClick={() => delAllegato.mutate()}
                disabled={delAllegato.isPending}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Rimuovi"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* File selezionato (in attesa di upload) */}
          {pendingFile && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
              <span className="text-amber-500">{fileIcon(pendingFile.name)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-800 truncate">{pendingFile.name}</p>
                <p className="text-xs text-amber-500">{(pendingFile.size / 1024).toFixed(0)} KB — verrà caricato al salvataggio</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Drop zone */}
          {!pendingFile && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
              }`}
            >
              <Paperclip size={20} className="text-gray-400" />
              <p className="text-sm text-gray-500">
                {hasExistingAllegato ? 'Trascina un file per sostituire l\'allegato' : 'Trascina un file o clicca per allegarlo'}
              </p>
              <p className="text-xs text-gray-400">PDF, immagini, Word, Excel — max 10 MB</p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
            </div>
          )}
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
