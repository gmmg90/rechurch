import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Database, Download, Upload, FileSpreadsheet,
  AlertTriangle, CheckCircle, HardDrive, Droplets, Cookie, Star, Heart, Package,
} from 'lucide-react'
import { backupApi } from '../api/client'
import { formatDate } from '../utils/date'

const TIPI_EXPORT = [
  { id: 'battesimi', label: 'Battesimi', icon: Droplets, color: 'text-blue-600 bg-blue-50' },
  { id: 'comunioni', label: 'Comunioni', icon: Cookie, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'cresime', label: 'Cresime', icon: Star, color: 'text-amber-600 bg-amber-50' },
  { id: 'matrimoni', label: 'Matrimoni', icon: Heart, color: 'text-rose-600 bg-rose-50' },
]

export default function BackupEsportazioni() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [restoreResult, setRestoreResult] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const { data: info, isLoading } = useQuery({
    queryKey: ['backup-info'],
    queryFn: backupApi.info,
  })

  const restoreMut = useMutation({
    mutationFn: (file: File) => backupApi.restore(file),
    onSuccess: (data) => {
      setRestoreResult(data.message)
      setRestoreError(null)
      qc.invalidateQueries({ queryKey: ['backup-info'] })
    },
    onError: (e: any) => {
      setRestoreError(e?.response?.data?.detail ?? 'Errore durante il ripristino')
      setRestoreResult(null)
    },
  })

  const handleRestoreClick = () => {
    if (window.confirm(
      'ATTENZIONE: il database corrente verrà sostituito completamente dal backup caricato.\n\n' +
      'Una copia del DB attuale verrà salvata come .bak nella cartella dati.\n\n' +
      'Vuoi continuare?'
    )) {
      fileRef.current?.click()
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) restoreMut.mutate(file)
    e.target.value = ''
  }

  return (
    <div className="p-8 max-w-5xl">
      <button
        onClick={() => navigate('/impostazioni')}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-4"
      >
        <ChevronLeft size={16} /> Impostazioni
      </button>

      <div className="flex items-start gap-3 mb-6">
        <div className="p-2.5 bg-indigo-100 rounded-xl">
          <HardDrive className="text-indigo-600" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Backup ed Esportazioni</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Salva una copia del database, ripristina da un backup precedente, esporta i dati in CSV
          </p>
        </div>
      </div>

      {/* Info DB */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="text-indigo-500" size={18} />
          <h2 className="font-semibold text-gray-800">Stato del database</h2>
        </div>

        {isLoading || !info ? (
          <div className="text-gray-400 text-sm">Caricamento...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Dimensione</p>
                <p className="text-lg font-semibold text-gray-800">{info.size_human}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Ultima modifica</p>
                <p className="text-lg font-semibold text-gray-800">
                  {info.modified ? formatDate(info.modified) : '—'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Percorso</p>
                <p className="text-sm font-mono text-gray-700 truncate" title={info.path}>{info.path}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{info.counts.battesimi}</p>
                <p className="text-xs text-blue-600 mt-0.5">Battesimi</p>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-700">{info.counts.comunioni}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Comunioni</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-700">{info.counts.cresime}</p>
                <p className="text-xs text-amber-600 mt-0.5">Cresime</p>
              </div>
              <div className="text-center p-3 bg-rose-50 rounded-lg">
                <p className="text-2xl font-bold text-rose-700">{info.counts.matrimoni}</p>
                <p className="text-xs text-rose-600 mt-0.5">Matrimoni</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Backup completo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Download className="text-indigo-600" size={18} />
            <h3 className="font-semibold text-gray-800">Backup completo</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Scarica una copia esatta del database (.db). Tienila al sicuro su disco esterno o cloud.
          </p>
          <a
            href={backupApi.downloadUrl()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
          >
            <Download size={15} /> Scarica backup .db
          </a>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="text-amber-600" size={18} />
            <h3 className="font-semibold text-gray-800">Ripristina backup</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Sostituisci il database con uno scaricato in precedenza.
            Verrà creata una copia di sicurezza dell'attuale.
          </p>
          <button
            onClick={handleRestoreClick}
            disabled={restoreMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 shadow-sm"
          >
            <Upload size={15} /> {restoreMut.isPending ? 'Ripristino…' : 'Carica backup .db'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".db"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </div>

      {restoreResult && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-emerald-700">{restoreResult}</div>
        </div>
      )}

      {restoreError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-red-700">{restoreError}</div>
        </div>
      )}

      {/* Esportazioni CSV */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet className="text-emerald-600" size={18} />
          <h2 className="font-semibold text-gray-800">Esporta in CSV</h2>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Esporta i dati in formato CSV (apribile in Excel). Una riga per record, tutti i campi inclusi.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {TIPI_EXPORT.map(({ id, label, icon: Icon, color }) => (
            <a
              key={id}
              href={backupApi.exportCsvUrl(id)}
              className={`flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors ${color}`}
              title={`Scarica ${label}.csv`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
              <Download size={14} className="ml-auto" />
            </a>
          ))}
        </div>

        <a
          href={backupApi.exportZipUrl()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm"
        >
          <Package size={15} /> Esporta tutto in ZIP
        </a>
      </div>

      {/* Suggerimenti */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">💡 Suggerimenti</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Esegui un backup completo prima di importare dati o di una modifica massiva.</li>
          <li>Conserva almeno un backup su disco esterno o cloud (chiavetta USB, Google Drive…).</li>
          <li>Il file <code className="px-1 bg-amber-100 rounded">.db</code> è uno SQLite standard: puoi anche copiarlo direttamente dalla cartella dati.</li>
        </ul>
      </div>
    </div>
  )
}
