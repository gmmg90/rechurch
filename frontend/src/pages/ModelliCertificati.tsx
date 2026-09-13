import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, FileText, Save, RotateCcw, Eye, Info,
  Droplets, Cookie, Star, Heart, Tag, AlertCircle, CheckCircle,
} from 'lucide-react'
import { reportTemplatesApi, type ReportTemplate, type Placeholder } from '../api/client'

type Tipo = 'battesimi' | 'comunioni' | 'cresime' | 'matrimoni'

const TIPI: { id: Tipo; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'battesimi', label: 'Battesimo', icon: Droplets, color: 'text-blue-600 bg-blue-50' },
  { id: 'comunioni', label: 'Comunione', icon: Cookie, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'cresime', label: 'Cresima', icon: Star, color: 'text-amber-600 bg-amber-50' },
  { id: 'matrimoni', label: 'Matrimonio', icon: Heart, color: 'text-rose-600 bg-rose-50' },
]

type SectionKey = 'titolo' | 'intro' | 'body' | 'chiusura' | 'firma_label'

const SECTIONS: { key: SectionKey; label: string; description: string; rows: number }[] = [
  { key: 'titolo', label: 'Titolo', description: 'Titolo del certificato (in maiuscolo)', rows: 1 },
  { key: 'intro', label: 'Introduzione', description: 'Riga introduttiva ("Il sottoscritto…")', rows: 2 },
  { key: 'body', label: 'Corpo principale', description: 'Testo del certificato. Usa una riga vuota per separare paragrafi.', rows: 12 },
  { key: 'chiusura', label: 'Chiusura', description: 'Frase finale opzionale (es. "Si rilascia in carta libera per")', rows: 2 },
  { key: 'firma_label', label: 'Etichetta firma', description: 'Etichetta sopra la firma (es. "IL PARROCO")', rows: 1 },
]

export default function ModelliCertificati() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<Tipo>('battesimi')
  const [form, setForm] = useState<Partial<ReportTemplate>>({})
  const [focused, setFocused] = useState<SectionKey>('body')
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  const { data: tpl } = useQuery({
    queryKey: ['report-template', tipo],
    queryFn: () => reportTemplatesApi.get(tipo),
  })

  const { data: phData } = useQuery({
    queryKey: ['placeholders', tipo],
    queryFn: () => reportTemplatesApi.placeholders(tipo),
  })

  useEffect(() => {
    if (tpl) setForm({
      titolo: tpl.titolo ?? '',
      intro: tpl.intro ?? '',
      body: tpl.body ?? '',
      chiusura: tpl.chiusura ?? '',
      firma_label: tpl.firma_label ?? '',
    })
  }, [tpl])

  const update = useMutation({
    mutationFn: (data: Partial<ReportTemplate>) => reportTemplatesApi.update(tipo, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-template', tipo] })
      setSavedAt(Date.now())
      setPreviewKey(k => k + 1)
      setTimeout(() => setSavedAt(null), 3000)
    },
  })

  const reset = useMutation({
    mutationFn: () => reportTemplatesApi.reset(tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-template', tipo] })
      setPreviewKey(k => k + 1)
    },
  })

  const dirty = !!tpl && (
    (form.titolo ?? '') !== (tpl.titolo ?? '') ||
    (form.intro ?? '') !== (tpl.intro ?? '') ||
    (form.body ?? '') !== (tpl.body ?? '') ||
    (form.chiusura ?? '') !== (tpl.chiusura ?? '') ||
    (form.firma_label ?? '') !== (tpl.firma_label ?? '')
  )

  const handleSave = () => update.mutate(form)
  const handleReset = () => {
    if (window.confirm('Ripristinare il template ai valori predefiniti? Le modifiche verranno perse.')) {
      reset.mutate()
    }
  }

  const insertPlaceholder = (key: string) => {
    const ta = textareaRefs.current[focused]
    if (!ta) return
    const text = form[focused] ?? ''
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = text.slice(0, start)
    const after = text.slice(end)
    const placeholder = `{${key}}`
    const next = before + placeholder + after
    setForm(f => ({ ...f, [focused]: next }))
    // Riposiziona il cursore dopo il segnaposto
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = start + placeholder.length
    }, 0)
  }

  const previewUrl = `${reportTemplatesApi.previewUrl(tipo)}&_=${previewKey}`

  return (
    <div className="p-8 max-w-7xl">
      <button
        onClick={() => navigate('/impostazioni')}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-4"
      >
        <ChevronLeft size={16} /> Impostazioni
      </button>

      <div className="flex items-start gap-3 mb-6">
        <div className="p-2.5 bg-indigo-100 rounded-xl">
          <FileText className="text-indigo-600" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Modelli dei certificati</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Personalizza il testo dei certificati senza toccare il codice. I campi tra parentesi graffe
            (es. <code className="px-1 bg-gray-100 rounded">{'{nome}'}</code>) sono segnaposti che verranno sostituiti con i dati del record.
          </p>
        </div>
      </div>

      {/* Tabs tipo */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TIPI.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setTipo(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tipo === id
                ? `${color} ring-2 ring-offset-1 ring-current`
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Editor */}
        <div className="xl:col-span-7 space-y-4">
          {SECTIONS.map(({ key, label, description, rows }) => (
            <div key={key} className={`bg-white rounded-xl border ${focused === key ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'} p-4`}>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-800">{label}</label>
                <span className="text-xs text-gray-400">{description}</span>
              </div>
              <textarea
                ref={el => { textareaRefs.current[key] = el }}
                value={form[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                onFocus={() => setFocused(key)}
                rows={rows}
                className="w-full font-mono text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
                placeholder={`Inserisci ${label.toLowerCase()}…`}
              />
            </div>
          ))}

          {/* Azioni */}
          <div className="flex items-center gap-3 pt-2 sticky bottom-0 bg-gray-50/95 backdrop-blur p-4 -mx-4 rounded-xl border border-gray-100">
            <button
              onClick={handleReset}
              disabled={reset.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
            >
              <RotateCcw size={15} /> Ripristina default
            </button>

            <div className="flex-1" />

            {savedAt && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm">
                <CheckCircle size={15} /> Salvato
              </span>
            )}

            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 font-medium"
            >
              <Eye size={15} /> Anteprima PDF
            </a>

            <button
              onClick={handleSave}
              disabled={!dirty || update.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium shadow-sm"
            >
              <Save size={15} /> {update.isPending ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        </div>

        {/* Palette segnaposti */}
        <div className="xl:col-span-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="text-indigo-500" size={16} />
              <h3 className="text-sm font-semibold text-gray-800">Segnaposti disponibili</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Clicca un segnaposto per inserirlo nel campo <strong>{SECTIONS.find(s => s.key === focused)?.label}</strong>.
            </p>

            <div className="flex flex-wrap gap-1.5 max-h-[400px] overflow-y-auto">
              {(phData?.placeholders ?? []).map((p: Placeholder) => (
                <button
                  key={p.key}
                  onClick={() => insertPlaceholder(p.key)}
                  className="text-xs px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors text-left group"
                  title={`Inserisce {${p.key}}`}
                >
                  <span className="font-mono">{`{${p.key}}`}</span>
                  <span className="text-indigo-400 ml-1.5 group-hover:text-indigo-600">{p.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1.5">
              <div className="flex items-start gap-1.5">
                <Info size={11} className="mt-0.5 shrink-0" />
                <p>I tag <code className="px-1 bg-gray-100 rounded font-mono">{'<b>…</b>'}</code> rendono il testo <strong>in grassetto</strong>.</p>
              </div>
              <div className="flex items-start gap-1.5">
                <Info size={11} className="mt-0.5 shrink-0" />
                <p>Un segnaposto senza valore viene sostituito con <code className="px-1 bg-gray-100 rounded">_______</code>.</p>
              </div>
              <div className="flex items-start gap-1.5">
                <AlertCircle size={11} className="mt-0.5 shrink-0 text-amber-500" />
                <p>
                  Per il matrimonio, il layout (intestazione Diocesi/Comune, tabella sposi, firma) resta fisso.
                  Sono modificabili solo le frasi di testo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
