import { useState, useRef } from 'react'
import { FileText, CheckCircle, AlertCircle, ChevronRight, Download, Info } from 'lucide-react'
import { importApi } from '../api/client'

type Tipo = 'battesimi' | 'comunioni' | 'cresime' | 'matrimoni'

const BATTESIMO_FIELDS = ['nome','cognome','data_nascita','luogo_nascita','data_battesimo','luogo_battesimo','padre_nome','madre_nome','padrino_nome','madrina_nome','ministro','numero_registro','anno_registro','note']
const COMUNIONE_FIELDS = ['nome','cognome','data_nascita','luogo_nascita','data_comunione','luogo_comunione','padre_nome','madre_nome','ministro','numero_registro','anno_registro','note']
const CRESIMA_FIELDS = ['nome','cognome','data_nascita','luogo_nascita','data_cresima','luogo_cresima','padre_nome','madre_nome','padrino_nome','madrina_nome','ministro','vescovo','numero_registro','anno_registro','note']
const MATRIMONIO_FIELDS = ['sposo_nome','sposo_cognome','sposo_luogo_nascita','sposo_data_nascita','sposa_nome','sposa_cognome','sposa_luogo_nascita','sposa_data_nascita','data_matrimonio','luogo_matrimonio','testimone1_nome','testimone2_nome','testimone3_nome','testimone4_nome','ministro','numero_registro','anno_registro','note']

const REQUIRED_BY_TIPO: Record<Tipo, Set<string>> = {
  battesimi: new Set(['nome', 'cognome', 'data_battesimo']),
  comunioni: new Set(['nome', 'cognome', 'data_comunione']),
  cresime: new Set(['nome', 'cognome', 'data_cresima']),
  matrimoni: new Set(['sposo_nome', 'sposo_cognome', 'sposa_nome', 'sposa_cognome', 'data_matrimonio']),
}

const LABELS: Record<Tipo, string> = {
  battesimi: 'Battesimi',
  comunioni: 'Comunioni',
  cresime: 'Cresime',
  matrimoni: 'Matrimoni',
}

function fieldsForTipo(tipo: Tipo) {
  if (tipo === 'battesimi') return BATTESIMO_FIELDS
  if (tipo === 'comunioni') return COMUNIONE_FIELDS
  if (tipo === 'cresime') return CRESIMA_FIELDS
  return MATRIMONIO_FIELDS
}

function FieldsGuide({ tipo }: { tipo: Tipo }) {
  const fields = fieldsForTipo(tipo)
  const required = REQUIRED_BY_TIPO[tipo]

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <Info className="text-indigo-500 shrink-0 mt-0.5" size={18} />
        <div className="flex-1">
          <p className="text-sm font-medium text-indigo-900">Formato file CSV per {LABELS[tipo]}</p>
          <p className="text-indigo-700 text-xs mt-1">
            Il file deve avere una riga di intestazione. Date in formato <code className="bg-white px-1 rounded">AAAA-MM-GG</code> oppure <code className="bg-white px-1 rounded">GG/MM/AAAA</code>.
            I campi <span className="font-semibold">in grassetto</span> sono obbligatori.
          </p>
        </div>
        <a
          href={importApi.templateUrl(tipo)}
          download
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-50 shrink-0"
        >
          <Download size={14} /> Scarica template
        </a>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {fields.map(f => (
          <span
            key={f}
            className={`text-xs px-2 py-1 rounded-md ${
              required.has(f)
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-white text-indigo-700 border border-indigo-200'
            }`}
            title={required.has(f) ? 'Campo obbligatorio' : 'Campo opzionale'}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ImportaDati() {
  const [tipo, setTipo] = useState<Tipo>('battesimi')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ columns: string[]; preview: Record<string, string>[]; total_rows: number } | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ inserted: number; errors: string[]; total_rows: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError('')
    setMapping({})
  }

  const handleFile = async (f: File) => {
    setFile(f)
    setPreview(null)
    setResult(null)
    setError('')
    setLoading(true)
    try {
      const p = await importApi.previewCsv(tipo, f)
      setPreview(p)
      const auto: Record<string, string> = {}
      fieldsForTipo(tipo).forEach(field => {
        const match = p.columns.find(c => c.toLowerCase().replace(/\s/g, '_') === field)
        if (match) auto[field] = match
      })
      setMapping(auto)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento del file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !preview) return

    const required = REQUIRED_BY_TIPO[tipo]
    const missing = [...required].filter(r => !mapping[r])
    if (missing.length > 0) {
      setError(`Mappare i campi obbligatori: ${missing.join(', ')}`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const r = await importApi.importCsv(tipo, file, mapping)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore durante l'importazione")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Importa Dati</h1>
        <p className="text-gray-500 text-sm mt-1">Carica un file CSV con i registri sacramentali</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Step 1: scelta tipo */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">1. Tipo di registro</p>
          <div className="flex gap-3">
            {(['battesimi', 'comunioni', 'cresime', 'matrimoni'] as Tipo[]).map(t => (
              <button
                key={t}
                onClick={() => { setTipo(t); reset() }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tipo === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: guida con template */}
        {!result && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">2. Prepara il file</p>
            <FieldsGuide tipo={tipo} />
          </div>
        )}

        {/* Step 3: upload */}
        {!preview && !result && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">3. Carica il CSV</p>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <FileText className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="text-gray-600 font-medium">Trascina il CSV qui o clicca per scegliere</p>
              <p className="text-gray-400 text-sm mt-1">Supporta UTF-8 e Latin-1, separatore virgola</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          </div>
        )}

        {loading && <div className="text-center text-gray-400 py-8">Elaborazione in corso...</div>}

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Step 4: mappatura colonne */}
        {preview && !result && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">4. Mappa le colonne</p>
            <p className="text-sm text-gray-600">
              File: <strong>{file?.name}</strong> — {preview.total_rows} righe trovate
            </p>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-3">
                {fieldsForTipo(tipo).map(field => {
                  const required = REQUIRED_BY_TIPO[tipo].has(field)
                  return (
                    <div key={field} className="flex items-center gap-2">
                      <span className={`text-xs w-36 shrink-0 ${required ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>
                        {field}{required && <span className="text-red-500"> *</span>}
                      </span>
                      <ChevronRight size={14} className="text-gray-300 shrink-0" />
                      <select
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={mapping[field] ?? ''}
                        onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                      >
                        <option value="">— non mappare —</option>
                        {preview.columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <p className="text-xs text-gray-400 px-4 py-2 border-b border-gray-100">Anteprima prime 10 righe</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {preview.columns.map(c => <th key={c} className="px-3 py-2 text-left text-gray-500 font-medium">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      {preview.columns.map(c => <td key={c} className="px-3 py-2 text-gray-600 max-w-32 truncate">{row[c]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={reset} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Annulla
              </button>
              <button onClick={handleImport} disabled={loading} className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                Importa {preview.total_rows} righe
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-green-700 font-medium">Importazione completata</p>
                <p className="text-green-600 text-sm mt-0.5">{result.inserted} record importati su {result.total_rows} righe</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-700 font-medium text-sm mb-2">{result.errors.length} righe con errori:</p>
                <ul className="text-amber-600 text-xs space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <button onClick={reset} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Nuova importazione
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
