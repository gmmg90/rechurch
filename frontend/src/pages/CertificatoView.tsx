import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, Printer, Unlock, FileDown, Save, X,
} from 'lucide-react'
import {
  battesimiApi, comunioniApi, cresimeApi, matrimoniApi, configApi, pdfApi,
  type Battesimo, type Comunione, type Cresima, type Matrimonio, type ParrocchiaConfig,
} from '../api/client'
import { formatDate } from '../utils/date'

type Tipo = 'battesimi' | 'comunioni' | 'cresime' | 'matrimoni'

const TITLES: Record<Tipo, string> = {
  battesimi: 'CERTIFICATO DI BATTESIMO',
  comunioni: 'CERTIFICATO DI PRIMA COMUNIONE',
  cresime: 'CERTIFICATO DI CRESIMA',
  matrimoni: 'CERTIFICATO DI MATRIMONIO',
}

const BACK_LABEL: Record<Tipo, string> = {
  battesimi: 'Battesimi',
  comunioni: 'Comunioni',
  cresime: 'Cresime',
  matrimoni: 'Matrimoni',
}

// ─── Editable cell ────────────────────────────────────────────────────────────

function Editable({
  value, editing, onChange, type = 'text', multiline = false, className = '',
}: {
  value: string | number | null | undefined
  editing: boolean
  onChange: (v: string) => void
  type?: 'text' | 'date' | 'number'
  multiline?: boolean
  className?: string
}) {
  const display = type === 'date' ? formatDate(value as string) : (value ?? '—')

  if (!editing) {
    if (multiline) {
      return <span className={`font-semibold text-gray-900 whitespace-pre-line ${className}`}>{display || '—'}</span>
    }
    return <span className={`font-semibold text-gray-900 ${className}`}>{display || '—'}</span>
  }

  if (multiline) {
    return (
      <textarea
        value={(value as string) ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className={`inline-block w-full border-b border-dashed border-indigo-300 bg-indigo-50/40 px-1 focus:outline-none focus:bg-indigo-50 resize-y ${className}`}
      />
    )
  }

  return (
    <input
      type={type}
      value={(value as string) ?? ''}
      onChange={e => onChange(e.target.value)}
      className={`inline-block border-b border-dashed border-indigo-300 bg-indigo-50/40 px-1 focus:outline-none focus:bg-indigo-50 ${
        type === 'date' ? 'w-44' : 'min-w-[8rem]'
      } ${className}`}
    />
  )
}

// ─── Common toolbar ───────────────────────────────────────────────────────────

function Toolbar({
  tipo, id, editing, dirty, saving,
  onBack, onPrint, onToggleEdit, onSave, onCancel,
}: {
  tipo: Tipo
  id: number
  editing: boolean
  dirty: boolean
  saving: boolean
  onBack: () => void
  onPrint: () => void
  onToggleEdit: () => void
  onSave: () => void
  onCancel: () => void
}) {
  const pdfDownloadUrl =
    tipo === 'battesimi' ? pdfApi.battesimoUrl(id) :
    tipo === 'comunioni' ? pdfApi.comunioneUrl(id) :
    tipo === 'cresime' ? pdfApi.cresimaUrl(id) :
    pdfApi.matrimonioUrl(id)

  return (
    <div className="no-print sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-3 flex items-center gap-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ChevronLeft size={16} /> {BACK_LABEL[tipo]}
      </button>

      <div className="flex-1" />

      <button
        onClick={onPrint}
        title="Apre il PDF in una nuova scheda, poi stampa dal lettore PDF"
        className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm"
      >
        <Printer size={16} /> Stampa
      </button>

      <a
        href={pdfDownloadUrl}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
        title="Scarica il PDF"
      >
        <FileDown size={16} /> Scarica PDF
      </a>

      {!editing ? (
        <button
          onClick={onToggleEdit}
          className="flex items-center gap-2 px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 font-medium"
        >
          <Unlock size={16} /> Sblocca modifica
        </button>
      ) : (
        <>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <X size={16} /> Annulla
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium shadow-sm"
          >
            <Save size={16} /> {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Sheet (foglio A4) ────────────────────────────────────────────────────────

function Sheet({ children, config, title, editing }: {
  children: React.ReactNode
  config?: ParrocchiaConfig
  title: string
  editing: boolean
}) {
  const logoUrl = config?.logo_path
    ? `/uploads/${config.logo_path.replace(/\\/g, '/').split('/').pop()}`
    : null

  return (
    <div className="certificate-sheet bg-white mx-auto my-8 shadow-lg print:shadow-none print:my-0">
      <div className="px-16 py-14 print:px-12 print:py-10" style={{ fontFamily: '"Times New Roman", Georgia, serif' }}>

        {/* Intestazione parrocchia */}
        <div className="flex items-center gap-5 border-b-4 border-double border-[#1e3a5f] pb-5 mb-8">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain" />
          )}
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-[#1e3a5f] tracking-wide">
              {config?.nome ?? 'Parrocchia'}
            </p>
            {config?.diocesi && <p className="text-sm text-gray-600 mt-1">Diocesi di {config.diocesi}</p>}
            {config?.indirizzo && <p className="text-sm text-gray-600">{config.indirizzo}</p>}
            {config?.citta && (
              <p className="text-sm text-gray-600">
                {config.cap ? `${config.cap} ` : ''}{config.citta}
                {config.provincia ? ` (${config.provincia})` : ''}
              </p>
            )}
            {(config?.telefono || config?.email) && (
              <p className="text-sm text-gray-600">
                {[config.telefono, config.email].filter(Boolean).join(' | ')}
              </p>
            )}
          </div>
        </div>

        {/* Titolo */}
        <h1 className="text-center text-2xl font-bold text-[#1e3a5f] tracking-widest my-10">
          {title}
        </h1>

        {/* Corpo */}
        <div className="text-[15px] leading-loose text-justify text-gray-800 space-y-4">
          {children}
        </div>

        {/* Firma */}
        <div className="mt-16 pt-6 border-t border-gray-300 flex justify-between text-sm text-gray-700">
          <div>
            {config?.citta ?? '___________'}, {formatDate(new Date().toISOString())}
          </div>
          <div className="text-center">
            <p>Il Parroco</p>
            <p className="mt-8 border-t border-gray-400 pt-1 min-w-[14rem]">
              {config?.parroco ?? ''}
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-10 italic">
          Documento rilasciato ad uso ecclesiastico/civile — non valido senza timbro e firma originale.
        </p>

        {editing && (
          <p className="no-print text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md py-1.5 mt-6">
            Modalità modifica attiva — clicca sui campi per modificarli, poi premi "Salva".
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Body renderers ───────────────────────────────────────────────────────────

function BattesimoBody({
  r, config, editing, setField,
}: {
  r: Battesimo
  config?: ParrocchiaConfig
  editing: boolean
  setField: <K extends keyof Battesimo>(k: K, v: Battesimo[K]) => void
}) {
  return (
    <>
      <p>
        Il sottoscritto Parroco della <strong>{config?.nome ?? 'Parrocchia'}</strong>
        {config?.citta && <> in <strong>{config.citta}</strong></>} certifica che:
      </p>

      <p>
        <Editable value={r.nome} editing={editing} onChange={v => setField('nome', v)} />{' '}
        <Editable value={r.cognome} editing={editing} onChange={v => setField('cognome', v)} />
        , nato/a il{' '}
        <Editable value={r.data_nascita} editing={editing} onChange={v => setField('data_nascita', v)} type="date" />
        {' '}a{' '}
        <Editable value={r.luogo_nascita} editing={editing} onChange={v => setField('luogo_nascita', v)} />
        , figlio/a di{' '}
        <Editable value={r.padre_nome} editing={editing} onChange={v => setField('padre_nome', v)} />
        {' '}e di{' '}
        <Editable value={r.madre_nome} editing={editing} onChange={v => setField('madre_nome', v)} />.
      </p>

      <p>
        È stato/a <strong>BATTEZZATO/A</strong> il giorno{' '}
        <Editable value={r.data_battesimo} editing={editing} onChange={v => setField('data_battesimo', v)} type="date" />
        {' '}presso{' '}
        <Editable value={r.luogo_battesimo} editing={editing} onChange={v => setField('luogo_battesimo', v)} />.
      </p>

      <p>
        Padrino:{' '}
        <Editable value={r.padrino_nome} editing={editing} onChange={v => setField('padrino_nome', v)} />
        {' '}— Madrina:{' '}
        <Editable value={r.madrina_nome} editing={editing} onChange={v => setField('madrina_nome', v)} />.
      </p>

      <p>
        Il sacramento è stato amministrato da{' '}
        <Editable value={r.ministro} editing={editing} onChange={v => setField('ministro', v)} />.
      </p>

      <p>
        Il presente atto è trascritto nel <strong>Registro dei Battesimi</strong> al n.{' '}
        <Editable value={r.numero_registro} editing={editing} onChange={v => setField('numero_registro', v)} />
        {' '}dell'anno{' '}
        <Editable value={r.anno_registro ?? ''} editing={editing}
                  onChange={v => setField('anno_registro', v ? Number(v) : undefined)} type="number" />.
      </p>

      {(r.note || editing) && (
        <p className="italic text-gray-600 text-sm">
          Note:{' '}
          <Editable value={r.note} editing={editing} onChange={v => setField('note', v)} multiline />
        </p>
      )}
    </>
  )
}

function ComunioneBody({
  r, config, editing, setField,
}: {
  r: Comunione
  config?: ParrocchiaConfig
  editing: boolean
  setField: <K extends keyof Comunione>(k: K, v: Comunione[K]) => void
}) {
  return (
    <>
      <p>
        Il sottoscritto Parroco della <strong>{config?.nome ?? 'Parrocchia'}</strong>
        {config?.citta && <> in <strong>{config.citta}</strong></>} certifica che:
      </p>

      <p>
        <Editable value={r.nome} editing={editing} onChange={v => setField('nome', v)} />{' '}
        <Editable value={r.cognome} editing={editing} onChange={v => setField('cognome', v)} />
        , nato/a il{' '}
        <Editable value={r.data_nascita} editing={editing} onChange={v => setField('data_nascita', v)} type="date" />
        {' '}a{' '}
        <Editable value={r.luogo_nascita} editing={editing} onChange={v => setField('luogo_nascita', v)} />
        , figlio/a di{' '}
        <Editable value={r.padre_nome} editing={editing} onChange={v => setField('padre_nome', v)} />
        {' '}e di{' '}
        <Editable value={r.madre_nome} editing={editing} onChange={v => setField('madre_nome', v)} />.
      </p>

      <p>
        Ha ricevuto la <strong>PRIMA COMUNIONE</strong> il giorno{' '}
        <Editable value={r.data_comunione} editing={editing} onChange={v => setField('data_comunione', v)} type="date" />
        {' '}presso{' '}
        <Editable value={r.luogo_comunione} editing={editing} onChange={v => setField('luogo_comunione', v)} />.
      </p>

      <p>
        Il sacramento è stato amministrato da{' '}
        <Editable value={r.ministro} editing={editing} onChange={v => setField('ministro', v)} />.
      </p>

      <p>
        Il presente atto è trascritto nel <strong>Registro delle Prime Comunioni</strong> al n.{' '}
        <Editable value={r.numero_registro} editing={editing} onChange={v => setField('numero_registro', v)} />
        {' '}dell'anno{' '}
        <Editable value={r.anno_registro ?? ''} editing={editing}
                  onChange={v => setField('anno_registro', v ? Number(v) : undefined)} type="number" />.
      </p>

      {(r.note || editing) && (
        <p className="italic text-gray-600 text-sm">
          Note:{' '}
          <Editable value={r.note} editing={editing} onChange={v => setField('note', v)} multiline />
        </p>
      )}
    </>
  )
}

function CresimaBody({
  r, config, editing, setField,
}: {
  r: Cresima
  config?: ParrocchiaConfig
  editing: boolean
  setField: <K extends keyof Cresima>(k: K, v: Cresima[K]) => void
}) {
  return (
    <>
      <p>
        Il sottoscritto Parroco della <strong>{config?.nome ?? 'Parrocchia'}</strong>
        {config?.citta && <> in <strong>{config.citta}</strong></>} certifica che:
      </p>

      <p>
        <Editable value={r.nome} editing={editing} onChange={v => setField('nome', v)} />{' '}
        <Editable value={r.cognome} editing={editing} onChange={v => setField('cognome', v)} />
        , nato/a il{' '}
        <Editable value={r.data_nascita} editing={editing} onChange={v => setField('data_nascita', v)} type="date" />
        {' '}a{' '}
        <Editable value={r.luogo_nascita} editing={editing} onChange={v => setField('luogo_nascita', v)} />
        , figlio/a di{' '}
        <Editable value={r.padre_nome} editing={editing} onChange={v => setField('padre_nome', v)} />
        {' '}e di{' '}
        <Editable value={r.madre_nome} editing={editing} onChange={v => setField('madre_nome', v)} />.
      </p>

      <p>
        Ha ricevuto il sacramento della <strong>CRESIMA</strong> il giorno{' '}
        <Editable value={r.data_cresima} editing={editing} onChange={v => setField('data_cresima', v)} type="date" />
        {' '}presso{' '}
        <Editable value={r.luogo_cresima} editing={editing} onChange={v => setField('luogo_cresima', v)} />.
      </p>

      <p>
        Il sacramento è stato conferito da S.E. il Vescovo{' '}
        <Editable value={r.vescovo} editing={editing} onChange={v => setField('vescovo', v)} />
        {' '}— Ministro:{' '}
        <Editable value={r.ministro} editing={editing} onChange={v => setField('ministro', v)} />.
      </p>

      <p>
        Padrino:{' '}
        <Editable value={r.padrino_nome} editing={editing} onChange={v => setField('padrino_nome', v)} />
        {' '}— Madrina:{' '}
        <Editable value={r.madrina_nome} editing={editing} onChange={v => setField('madrina_nome', v)} />.
      </p>

      <p>
        Il presente atto è trascritto nel <strong>Registro delle Cresime</strong> al n.{' '}
        <Editable value={r.numero_registro} editing={editing} onChange={v => setField('numero_registro', v)} />
        {' '}dell'anno{' '}
        <Editable value={r.anno_registro ?? ''} editing={editing}
                  onChange={v => setField('anno_registro', v ? Number(v) : undefined)} type="number" />.
      </p>

      {(r.note || editing) && (
        <p className="italic text-gray-600 text-sm">
          Note:{' '}
          <Editable value={r.note} editing={editing} onChange={v => setField('note', v)} multiline />
        </p>
      )}
    </>
  )
}

function MatrimonioBody({
  r, config, editing, setField,
}: {
  r: Matrimonio
  config?: ParrocchiaConfig
  editing: boolean
  setField: <K extends keyof Matrimonio>(k: K, v: Matrimonio[K]) => void
}) {
  return (
    <>
      <p className="text-center italic">
        Il sottoscritto {config?.parroco ?? 'Parroco'}
      </p>
      <p className="text-center font-bold text-base tracking-wide my-3">CERTIFICA</p>

      <p>
        risultare dai registri degli atti di <strong>MATRIMONIO</strong> di questa Parrocchia,
        al numero d'ordine{' '}
        <Editable value={r.numero_registro} editing={editing} onChange={v => setField('numero_registro', v)} />
        {' '}che in data{' '}
        <Editable value={r.data_matrimonio} editing={editing} onChange={v => setField('data_matrimonio', v)} type="date" />
        {' '}contrassero matrimonio religioso
      </p>

      <p>
        il Sig.{' '}
        <Editable value={r.sposo_cognome?.toUpperCase()} editing={editing} onChange={v => setField('sposo_cognome', v)} />{' '}
        <Editable value={r.sposo_nome?.toUpperCase()} editing={editing} onChange={v => setField('sposo_nome', v)} />
      </p>
      <p>
        nato a{' '}
        <Editable value={r.sposo_luogo_nascita?.toUpperCase()} editing={editing} onChange={v => setField('sposo_luogo_nascita', v)} />
        {' '}il{' '}
        <Editable value={r.sposo_data_nascita} editing={editing} onChange={v => setField('sposo_data_nascita', v)} type="date" />
      </p>

      <p>
        e la Sig.ra{' '}
        <Editable value={r.sposa_cognome?.toUpperCase()} editing={editing} onChange={v => setField('sposa_cognome', v)} />{' '}
        <Editable value={r.sposa_nome?.toUpperCase()} editing={editing} onChange={v => setField('sposa_nome', v)} />
      </p>
      <p>
        nata a{' '}
        <Editable value={r.sposa_luogo_nascita?.toUpperCase()} editing={editing} onChange={v => setField('sposa_luogo_nascita', v)} />
        {' '}il{' '}
        <Editable value={r.sposa_data_nascita} editing={editing} onChange={v => setField('sposa_data_nascita', v)} type="date" />
      </p>

      <div className="pt-4">
        <p>
          essendo testimoni:{' '}
          <Editable value={r.testimone1_nome?.toUpperCase()} editing={editing} onChange={v => setField('testimone1_nome', v)} />
        </p>
        {(r.testimone2_nome || editing) && (
          <p className="pl-32">
            <Editable value={r.testimone2_nome?.toUpperCase()} editing={editing} onChange={v => setField('testimone2_nome', v)} />
          </p>
        )}
        {(r.testimone3_nome || editing) && (
          <p className="pl-32">
            <Editable value={r.testimone3_nome?.toUpperCase()} editing={editing} onChange={v => setField('testimone3_nome', v)} />
          </p>
        )}
        {(r.testimone4_nome || editing) && (
          <p className="pl-32">
            <Editable value={r.testimone4_nome?.toUpperCase()} editing={editing} onChange={v => setField('testimone4_nome', v)} />
          </p>
        )}
      </div>

      <p className="text-center italic pt-8">
        Si rilascia il presente in carta libera per
      </p>

      {(r.note || editing) && (
        <p className="italic text-gray-600 text-sm pt-4">
          Note:{' '}
          <Editable value={r.note} editing={editing} onChange={v => setField('note', v)} multiline />
        </p>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CertificatoView({ tipo }: { tipo: Tipo }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const numId = Number(id)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Battesimo | Comunione | Cresima | Matrimonio | null>(null)

  const api: any =
    tipo === 'battesimi' ? battesimiApi :
    tipo === 'comunioni' ? comunioniApi :
    tipo === 'cresime' ? cresimeApi :
    matrimoniApi

  const { data, isLoading, error } = useQuery<Battesimo | Comunione | Cresima | Matrimonio>({
    queryKey: [tipo, numId],
    queryFn: () => api.get(numId),
    enabled: !!numId,
  })

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const dirty = useMemo(() => {
    if (!data || !form) return false
    return JSON.stringify(data) !== JSON.stringify(form)
  }, [data, form])

  const update = useMutation({
    mutationFn: (payload: any) => api.update(numId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [tipo] })
      qc.invalidateQueries({ queryKey: [tipo, numId] })
      setEditing(false)
    },
  })

  const setField = (k: string, v: unknown) => {
    setForm(prev => (prev ? ({ ...prev, [k]: v } as typeof prev) : prev))
  }

  const handleSave = () => {
    if (!form) return
    const { id: _id, created_at: _c, updated_at: _u, ...payload } = form as any
    update.mutate(payload)
  }

  const handleCancel = () => {
    if (data) setForm(data)
    setEditing(false)
  }

  const backTo = `/${tipo}`

  const pdfViewUrl =
    tipo === 'battesimi' ? pdfApi.battesimoView(numId) :
    tipo === 'comunioni' ? pdfApi.comunioneView(numId) :
    tipo === 'cresime' ? pdfApi.cresimaView(numId) :
    pdfApi.matrimonioView(numId)

  const handlePrint = () => {
    if (dirty) {
      const proceed = window.confirm(
        'Hai modifiche non salvate. Il PDF mostrerà i dati attualmente salvati. Vuoi continuare?'
      )
      if (!proceed) return
    }
    window.open(pdfViewUrl, '_blank', 'noopener,noreferrer')
  }

  if (isLoading || !form) {
    return (
      <div className="p-12 text-center text-gray-400">Caricamento certificato…</div>
    )
  }

  if (error) {
    return (
      <div className="p-12 text-center text-red-500">Errore nel caricamento</div>
    )
  }

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      <Toolbar
        tipo={tipo}
        id={numId}
        editing={editing}
        dirty={dirty}
        saving={update.isPending}
        onBack={() => navigate(backTo)}
        onPrint={handlePrint}
        onToggleEdit={() => setEditing(true)}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      <Sheet config={config} title={TITLES[tipo]} editing={editing}>
        {tipo === 'battesimi' && (
          <BattesimoBody r={form as Battesimo} config={config} editing={editing} setField={setField} />
        )}
        {tipo === 'comunioni' && (
          <ComunioneBody r={form as Comunione} config={config} editing={editing} setField={setField} />
        )}
        {tipo === 'cresime' && (
          <CresimaBody r={form as Cresima} config={config} editing={editing} setField={setField} />
        )}
        {tipo === 'matrimoni' && (
          <MatrimonioBody r={form as Matrimonio} config={config} editing={editing} setField={setField} />
        )}
      </Sheet>
    </div>
  )
}
