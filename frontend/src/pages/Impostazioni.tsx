import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Upload, Trash2, Building2, Database, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { configApi, backupApi, type ParrocchiaConfig } from '../api/client'

type FormData = Omit<ParrocchiaConfig, 'id' | 'logo_path' | 'updated_at'>

export default function Impostazioni() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: configApi.get,
  })

  const [form, setForm] = useState<FormData>({
    nome: '', diocesi: '', indirizzo: '', cap: '', citta: '',
    provincia: '', telefono: '', email: '', parroco: '',
  })

  useEffect(() => {
    if (config) {
      setForm({
        nome:      config.nome      ?? '',
        diocesi:   config.diocesi   ?? '',
        indirizzo: config.indirizzo ?? '',
        cap:       config.cap       ?? '',
        citta:     config.citta     ?? '',
        provincia: config.provincia ?? '',
        telefono:  config.telefono  ?? '',
        email:     config.email     ?? '',
        parroco:   config.parroco   ?? '',
      })
      if (config.logo_path) {
        const filename = config.logo_path.split('/').pop()
        setLogoPreview(`/uploads/${filename}`)
      }
    }
  }, [config])

  const saveMut = useMutation({
    mutationFn: () => configApi.update(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      toast.success('Impostazioni salvate')
    },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  const logoMut = useMutation({
    mutationFn: (file: File) => configApi.uploadLogo(file),
    onSuccess: (data) => {
      setLogoPreview(data.logo_url)
      qc.invalidateQueries({ queryKey: ['config'] })
      toast.success('Logo caricato')
    },
    onError: () => toast.error('Errore nel caricamento del logo'),
  })

  const delLogoMut = useMutation({
    mutationFn: configApi.deleteLogo,
    onSuccess: () => {
      setLogoPreview(null)
      qc.invalidateQueries({ queryKey: ['config'] })
      toast.success('Logo rimosso')
    },
    onError: () => toast.error('Errore nella rimozione del logo'),
  })

  // Backup
  const { data: backups = [], refetch: refetchBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: backupApi.lista,
  })

  const backupMut = useMutation({
    mutationFn: backupApi.esegui,
    onSuccess: (data) => {
      toast.success(`Backup creato: ${data.filename}`)
      refetchBackups()
    },
    onError: () => toast.error('Errore nella creazione del backup'),
  })

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) logoMut.mutate(file)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (isLoading) return <div className="p-8 text-gray-400">Caricamento...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Impostazioni Parrocchia</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Questi dati appaiono nell'intestazione di tutti i certificati PDF
          </p>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Logo parrocchia</h2>
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-xs text-gray-400 text-center px-2">Nessun logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={logoMut.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Upload size={15} />
              {logoMut.isPending ? 'Caricamento...' : 'Carica logo'}
            </button>
            {logoPreview && (
              <button
                onClick={() => delLogoMut.mutate()}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={15} /> Rimuovi logo
              </button>
            )}
            <p className="text-xs text-gray-400">PNG o JPG, idealmente 200×200 px</p>
          </div>
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Dati parrocchia */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Dati parrocchia</h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Nome parrocchia *" value={form.nome} onChange={set('nome')} placeholder="Parrocchia San Giovanni" />
          <Field label="Diocesi" value={form.diocesi ?? ''} onChange={set('diocesi')} placeholder="es. Diocesi di Roma" />
          <Field label="Indirizzo" value={form.indirizzo ?? ''} onChange={set('indirizzo')} placeholder="Via Roma 1" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="CAP" value={form.cap ?? ''} onChange={set('cap')} placeholder="00100" />
            <div className="col-span-2">
              <Field label="Città" value={form.citta ?? ''} onChange={set('citta')} placeholder="Roma" />
            </div>
          </div>
          <Field label="Provincia" value={form.provincia ?? ''} onChange={set('provincia')} placeholder="RM" />
        </div>
      </div>

      {/* Contatti e firma */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Contatti e firma</h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Telefono" value={form.telefono ?? ''} onChange={set('telefono')} placeholder="06 12345678" />
          <Field label="Email" value={form.email ?? ''} onChange={set('email')} placeholder="parrocchia@diocesi.it" />
          <Field label="Nome parroco" value={form.parroco ?? ''} onChange={set('parroco')} placeholder="Don Mario Rossi — appare nella firma del certificato" />
        </div>
      </div>

      {/* Anteprima intestazione */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Anteprima intestazione PDF</h2>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-4 mb-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-14 h-14 object-contain" />
            ) : (
              <div className="w-14 h-14 rounded bg-indigo-100 flex items-center justify-center">
                <Building2 size={24} className="text-indigo-400" />
              </div>
            )}
            <div>
              <p className="font-bold text-indigo-900 text-base">{form.nome || 'Nome Parrocchia'}</p>
              {form.diocesi && <p className="text-xs text-gray-500">Diocesi di {form.diocesi}</p>}
              {form.indirizzo && <p className="text-xs text-gray-500">{form.indirizzo}</p>}
              {form.citta && (
                <p className="text-xs text-gray-500">
                  {form.cap && `${form.cap} `}{form.citta}{form.provincia && ` (${form.provincia})`}
                </p>
              )}
              {(form.telefono || form.email) && (
                <p className="text-xs text-gray-400">{[form.telefono, form.email].filter(Boolean).join(' | ')}</p>
              )}
            </div>
          </div>
          <div className="border-t-2 border-indigo-900 border-b border-indigo-300 mb-3" />
          <p className="text-center font-bold text-indigo-900 text-sm tracking-widest">CERTIFICATO DI BATTESIMO</p>
        </div>
      </div>

      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 mb-8"
      >
        <Save size={16} />
        {saveMut.isPending ? 'Salvataggio...' : 'Salva impostazioni'}
      </button>

      {/* Backup Section */}
      <div className="flex items-center gap-3 mb-4">
        <Database className="text-indigo-600" size={22} />
        <div>
          <h2 className="text-lg font-bold text-gray-800">Backup database</h2>
          <p className="text-gray-500 text-sm">I backup automatici vengono eseguiti ogni notte alle 02:00</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            {backups.length === 0
              ? 'Nessun backup disponibile'
              : `${backups.length} backup disponibil${backups.length === 1 ? 'e' : 'i'}`}
          </p>
          <button
            onClick={() => backupMut.mutate()}
            disabled={backupMut.isPending}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Database size={15} />
            {backupMut.isPending ? 'Creazione...' : 'Esegui backup ora'}
          </button>
        </div>

        {backups.length > 0 && (
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Dimensione
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{b.filename}</td>
                    <td className="px-4 py-3 text-gray-500">{b.size_kb} KB</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(b.created_at)}</td>
                    <td className="px-4 py-3">
                      <a
                        href={backupApi.downloadUrl(b.filename)}
                        download={b.filename}
                        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        <Download size={14} />
                        Scarica
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </div>
  )
}
