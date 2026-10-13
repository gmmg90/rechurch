import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Camera, Upload, X, Check, Search, ChevronRight,
  RotateCcw, ZoomIn, ScanLine, Loader2, Plus, Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { contabilitaApi, type MovimentoContabile } from '../api/client'

type Step = 'capture' | 'preview' | 'select' | 'done'

const formatEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT')

/* ── Canvas filter: boost contrast for document look ── */
function applyDocumentFilter(src: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = src.naturalWidth
  canvas.height = src.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'contrast(1.3) brightness(1.05) saturate(0.8)'
  ctx.drawImage(src, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export default function Scanner() {
  const [step, setStep] = useState<Step>('capture')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [filteredData, setFilteredData] = useState<string | null>(null)
  const [useFilter, setUseFilter] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMovimento, setSelectedMovimento] = useState<MovimentoContabile | null>(null)
  const [newTipo, setNewTipo] = useState<'entrata' | 'uscita'>('uscita')
  const [newImporto, setNewImporto] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [createNew, setCreateNew] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const qc = useQueryClient()

  useEffect(() => { document.title = 'Scanner — ReChurch' }, [])

  const { data: movimenti = [], isLoading: loadingMov } = useQuery({
    queryKey: ['movimenti-scanner', search],
    queryFn: () => contabilitaApi.listMovimenti({
      search: search || undefined,
      limit: 30,
    }),
    enabled: step === 'select',
  })

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un\'immagine')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const data = e.target?.result as string
      setImageData(data)
      setImageFile(file)
      setFilteredData(null)
      setStep('preview')
    }
    reader.readAsDataURL(file)
  }, [])

  const applyFilter = useCallback(() => {
    if (!imgRef.current) return
    const filtered = applyDocumentFilter(imgRef.current)
    setFilteredData(filtered)
  }, [])

  const displayImage = useFilter && filteredData ? filteredData : imageData

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!imageFile && !filteredData) throw new Error('Nessuna immagine')

      let targetId: number

      if (createNew) {
        if (!newImporto || !newDesc) throw new Error('Compila importo e descrizione')
        const mov = await contabilitaApi.createMovimento({
          data: new Date().toISOString().split('T')[0],
          tipo: newTipo,
          importo: parseFloat(newImporto),
          descrizione: newDesc,
        })
        targetId = mov.id
      } else {
        if (!selectedMovimento) throw new Error('Seleziona un movimento')
        targetId = selectedMovimento.id
      }

      // Build file to upload — if filter applied, convert dataURL back to File
      let fileToUpload: File
      if (useFilter && filteredData) {
        const res = await fetch(filteredData)
        const blob = await res.blob()
        fileToUpload = new File([blob], imageFile?.name ?? 'scan.jpg', { type: 'image/jpeg' })
      } else {
        fileToUpload = imageFile!
      }

      await contabilitaApi.uploadAllegato(targetId, fileToUpload)
      return targetId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimenti'] })
      setStep('done')
      toast.success('Allegato caricato!')
    },
    onError: (e: Error) => toast.error(e.message || 'Errore nel caricamento'),
  })

  const reset = () => {
    setStep('capture')
    setImageData(null)
    setImageFile(null)
    setFilteredData(null)
    setSelectedMovimento(null)
    setSearch('')
    setCreateNew(false)
    setNewImporto('')
    setNewDesc('')
  }

  /* ─────────────────────────────── STEP: capture ─── */
  if (step === 'capture') {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-safe pt-6 pb-4 bg-gray-900 border-b border-gray-800">
          <ScanLine className="text-indigo-400" size={22} />
          <h1 className="font-bold text-lg tracking-tight">Scanner Documenti</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="w-24 h-24 rounded-full bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center">
            <ScanLine size={40} className="text-indigo-400" />
          </div>

          <div className="text-center">
            <p className="text-gray-200 font-semibold text-lg">Scansiona un documento</p>
            <p className="text-gray-500 text-sm mt-1">Ricevuta, fattura, scontrino</p>
          </div>

          {/* Camera button — triggers device camera on mobile */}
          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.setAttribute('capture', 'environment')
                fileRef.current.click()
              }
            }}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-4 rounded-2xl font-semibold text-lg transition-colors"
          >
            <Camera size={22} />
            Scatta foto
          </button>

          {/* File upload fallback */}
          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.removeAttribute('capture')
                fileRef.current.click()
              }
            }}
            className="w-full flex items-center justify-center gap-3 border border-gray-700 hover:border-gray-500 text-gray-300 py-3.5 rounded-2xl font-medium transition-colors"
          >
            <Upload size={18} />
            Carica da galleria / file
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs pb-6 px-8">
          I file vengono caricati direttamente sulla parrocchia — nessun dato esce dal dispositivo.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>
    )
  }

  /* ─────────────────────────────── STEP: preview ─── */
  if (step === 'preview') {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white">
        <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4 bg-gray-900 border-b border-gray-800">
          <button onClick={reset} className="p-2 text-gray-400 hover:text-white rounded-lg">
            <X size={20} />
          </button>
          <h1 className="font-bold text-base">Anteprima</h1>
          <button
            onClick={() => { if (fileRef.current) { fileRef.current.setAttribute('capture', 'environment'); fileRef.current.click() } }}
            className="p-2 text-gray-400 hover:text-white rounded-lg"
            title="Rifai foto"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Image preview */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-gray-900 relative">
          {displayImage && (
            <img
              ref={imgRef}
              src={displayImage}
              alt="Scansione"
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
              onLoad={() => { if (useFilter && !filteredData) applyFilter() }}
            />
          )}
          {/* Scan line animation overlay */}
          {!filteredData && (
            <div className="absolute inset-4 pointer-events-none">
              <div className="w-full h-0.5 bg-indigo-400/60 animate-[scan_2s_ease-in-out_infinite]" style={{ animation: 'none', opacity: 0 }} />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-5 py-4 bg-gray-900 border-t border-gray-800 space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <ZoomIn size={16} className="text-gray-400" />
              <span className="text-sm text-gray-300">Filtro documento</span>
            </div>
            <div
              onClick={() => {
                const next = !useFilter
                setUseFilter(next)
                if (next && !filteredData && imgRef.current) applyFilter()
              }}
              className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${useFilter ? 'bg-indigo-600' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white mt-1 transition-transform ${useFilter ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </label>

          <button
            onClick={() => setStep('select')}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-3.5 rounded-2xl font-semibold transition-colors"
          >
            <Check size={18} />
            Usa questa foto
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>
    )
  }

  /* ─────────────────────────────── STEP: select ─── */
  if (step === 'select') {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center gap-3 px-5 pt-safe pt-6 pb-4 bg-white border-b border-gray-100 shadow-sm">
          <button onClick={() => setStep('preview')} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={20} />
          </button>
          <h1 className="font-bold text-gray-800 text-base flex-1">Associa a movimento</h1>
          {/* Thumbnail */}
          {displayImage && (
            <img src={displayImage} className="w-10 h-10 rounded-lg object-cover border border-gray-200" alt="" />
          )}
        </div>

        {/* Tab: nuovo vs esistente */}
        <div className="flex gap-0 border-b border-gray-100">
          <button
            onClick={() => setCreateNew(false)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${!createNew ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
          >
            Movimento esistente
          </button>
          <button
            onClick={() => setCreateNew(true)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${createNew ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
          >
            Crea nuovo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!createNew ? (
            /* ── Cerca movimento esistente ── */
            <div>
              <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="Cerca per descrizione, importo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {loadingMov ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-indigo-400" />
                </div>
              ) : movimenti.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Wallet size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nessun movimento trovato</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {movimenti.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMovimento(m)}
                      className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left ${
                        selectedMovimento?.id === m.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.tipo === 'entrata' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.descrizione}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(m.data)}{m.categoria_nome ? ` · ${m.categoria_nome}` : ''}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-semibold tabular-nums ${m.tipo === 'entrata' ? 'text-green-600' : 'text-red-500'}`}>
                          {m.tipo === 'uscita' ? '−' : '+'}{formatEur(m.importo)}
                        </p>
                        {m.allegato_nome && (
                          <p className="text-xs text-amber-500 mt-0.5">già allegato</p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Crea nuovo movimento ── */
            <div className="p-5 space-y-4">
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setNewTipo('entrata')}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${newTipo === 'entrata' ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Entrata
                </button>
                <button
                  type="button"
                  onClick={() => setNewTipo('uscita')}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${newTipo === 'uscita' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  Uscita
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Importo (€) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="0,00"
                    value={newImporto}
                    onChange={e => setNewImporto(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrizione *</label>
                <input
                  type="text"
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Es. Acquisto materiali liturgici"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>

              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                Verrà creato un nuovo movimento con data odierna e l'immagine verrà allegata automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* Bottom action */}
        <div className="px-5 pb-safe pb-6 pt-4 border-t border-gray-100 bg-white">
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending || (!createNew && !selectedMovimento) || (createNew && (!newImporto || !newDesc))}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-2xl font-semibold transition-colors"
          >
            {uploadMutation.isPending ? (
              <><Loader2 size={18} className="animate-spin" /> Caricamento...</>
            ) : createNew ? (
              <><Plus size={18} /> Crea e allega</>
            ) : (
              <><Upload size={18} /> Allega al movimento</>
            )}
          </button>
        </div>
      </div>
    )
  }

  /* ─────────────────────────────── STEP: done ─── */
  return (
    <div className="flex flex-col h-full bg-white items-center justify-center gap-6 px-8">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <Check size={36} className="text-green-600" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-800">Allegato caricato!</h2>
        <p className="text-gray-500 text-sm mt-1">Il documento è stato associato al movimento.</p>
      </div>
      {displayImage && (
        <img src={displayImage} className="w-32 h-32 object-cover rounded-2xl shadow-md border border-gray-100" alt="Scansione" />
      )}
      <button
        onClick={reset}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-semibold transition-colors"
      >
        <ScanLine size={18} />
        Scansiona un altro
      </button>
      <a
        href="/contabilita"
        className="text-indigo-600 text-sm hover:underline"
      >
        Vai alla contabilità
      </a>
    </div>
  )
}
