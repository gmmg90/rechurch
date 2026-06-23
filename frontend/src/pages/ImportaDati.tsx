import { useState, useRef } from 'react'
import { FileText, Database, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { importApi } from '../api/client'

type Tipo = 'battesimi' | 'cresime' | 'matrimoni'

const BATTESIMO_FIELDS = ['nome','cognome','data_nascita','luogo_nascita','data_battesimo','luogo_battesimo','padre_nome','madre_nome','padrino_nome','madrina_nome','ministro','numero_registro','anno_registro','note']
const CRESIMA_FIELDS = ['nome','cognome','data_nascita','luogo_nascita','data_cresima','luogo_cresima','padre_nome','madre_nome','padrino_nome','madrina_nome','ministro','vescovo','numero_registro','anno_registro','note']
const MATRIMONIO_FIELDS = ['sposo_nome','sposo_cognome','sposa_nome','sposa_cognome','data_matrimonio','luogo_matrimonio','testimone1_nome','testimone2_nome','ministro','numero_registro','anno_registro','note']

function fieldsForTipo(tipo: Tipo) {
  if (tipo === 'battesimi') return BATTESIMO_FIELDS
  if (tipo === 'cresime') return CRESIMA_FIELDS
  return MATRIMONIO_FIELDS
}

// ─── CSV Tab ──────────────────────────────────────────────────────────────────

function CsvImport() {
  const [tipo, setTipo] = useState<Tipo>('battesimi')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ columns: string[]; preview: Record<string, string>[]; total_rows: number } | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ inserted: number; errors: string[]; total_rows: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    setLoading(true)
    setError('')
    try {
      const r = await importApi.importCsv(tipo, file, mapping)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore durante l\'importazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {(['battesimi', 'cresime', 'matrimoni'] as Tipo[]).map(t => (
          <button
            key={t}
            onClick={() => { setTipo(t); setFile(null); setPreview(null); setResult(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tipo === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!preview && !result && (
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
      )}

      {loading && <div className="text-center text-gray-400 py-8">Elaborazione in corso...</div>}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            File: <strong>{file?.name}</strong> — {preview.total_rows} righe trovate
          </p>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Mappatura colonne</p>
            <div className="grid grid-cols-2 gap-3">
              {fieldsForTipo(tipo).map(field => (
                <div key={field} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-36 shrink-0">{field}</span>
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
              ))}
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
            <button onClick={() => { setPreview(null); setFile(null) }} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
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
          <button onClick={() => { setResult(null); setFile(null); setPreview(null) }} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Nuova importazione
          </button>
        </div>
      )}
    </div>
  )
}

// ─── MDB Tab ──────────────────────────────────────────────────────────────────

function MdbImport() {
  const [file, setFile] = useState<File | null>(null)
  const [mdbData, setMdbData] = useState<{ session_id: string; tables: { name: string; columns: string[]; sample: string[][] }[] } | null>(null)
  const [tableMappings, setTableMappings] = useState<Record<string, { tipo: Tipo; column_mapping: Record<string, string> }>>({})
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (f: File) => {
    setFile(f)
    setMdbData(null)
    setResult(null)
    setError('')
    setLoading(true)
    try {
      const d = await importApi.uploadMdb(f)
      setMdbData(d)
      const init: typeof tableMappings = {}
      d.tables.forEach(t => {
        init[t.name] = { tipo: 'battesimi', column_mapping: {} }
      })
      setTableMappings(init)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? (e instanceof Error ? e.message : 'Errore')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!mdbData) return
    setLoading(true)
    setError('')
    try {
      const mappings = Object.entries(tableMappings).map(([table, m]) => ({
        table,
        tipo: m.tipo,
        column_mapping: m.column_mapping,
      }))
      const r = await importApi.confirmMdb({ session_id: mdbData.session_id, mappings })
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore durante l\'importazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <strong>Requisito:</strong> Il server deve avere <code className="bg-amber-100 px-1 rounded">mdbtools</code> installato (<code className="bg-amber-100 px-1 rounded">apt install mdbtools</code>).
      </div>

      {!mdbData && !result && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
        >
          <Database className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-600 font-medium">Trascina il file .mdb o .accdb qui</p>
          <p className="text-gray-400 text-sm mt-1">Il file verrà analizzato per rilevare le tabelle</p>
          <input ref={fileRef} type="file" accept=".mdb,.accdb" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {loading && <div className="text-center text-gray-400 py-8">Analisi del file in corso...</div>}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {mdbData && !result && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">File: <strong>{file?.name}</strong> — {mdbData.tables.length} tabelle trovate</p>

          {mdbData.tables.map(table => {
            const tm = tableMappings[table.name] ?? { tipo: 'battesimi' as Tipo, column_mapping: {} }
            const fields = fieldsForTipo(tm.tipo)
            return (
              <div key={table.name} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-4 mb-4">
                  <p className="font-medium text-gray-800">{table.name}</p>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={tm.tipo}
                    onChange={e => setTableMappings(prev => ({
                      ...prev,
                      [table.name]: { tipo: e.target.value as Tipo, column_mapping: {} }
                    }))}
                  >
                    <option value="battesimi">Battesimi</option>
                    <option value="cresime">Cresime</option>
                    <option value="matrimoni">Matrimoni</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {fields.map(field => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-36 shrink-0">{field}</span>
                      <ChevronRight size={12} className="text-gray-300 shrink-0" />
                      <select
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        value={tm.column_mapping[field] ?? ''}
                        onChange={e => setTableMappings(prev => ({
                          ...prev,
                          [table.name]: {
                            ...prev[table.name],
                            column_mapping: { ...prev[table.name].column_mapping, [field]: e.target.value }
                          }
                        }))}
                      >
                        <option value="">— non mappare —</option>
                        {table.columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="flex gap-3 justify-end">
            <button onClick={() => { setMdbData(null); setFile(null) }} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Annulla
            </button>
            <button onClick={handleConfirm} disabled={loading} className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
              Importa dati
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
              <p className="text-green-600 text-sm mt-0.5">{result.inserted} record importati</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-700 font-medium text-sm mb-2">{result.errors.length} errori:</p>
              <ul className="text-amber-600 text-xs space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <button onClick={() => { setResult(null); setFile(null); setMdbData(null) }} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Nuova importazione
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ImportaDati() {
  const [tab, setTab] = useState<'csv' | 'mdb'>('csv')

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Importa Dati</h1>
        <p className="text-gray-500 text-sm mt-1">Migra i dati dal tuo database Access</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('csv')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'csv' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={16} /> Importa CSV
        </button>
        <button
          onClick={() => setTab('mdb')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'mdb' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Database size={16} /> Importa MDB/ACCDB
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {tab === 'csv' ? <CsvImport /> : <MdbImport />}
      </div>
    </div>
  )
}
