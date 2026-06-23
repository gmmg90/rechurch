import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, Download, Wallet, TrendingUp, TrendingDown, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { contabilitaApi, type CategoriaContabile, type Fornitore } from '../../api/client'

type Tab = 'movimenti' | 'categorie' | 'fornitori'

const formatEur = (amount: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT')

export default function ContabilitaList() {
  const [tab, setTab] = useState<Tab>('movimenti')
  const [rawSearch, setRawSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [dal, setDal] = useState('')
  const [al, setAl] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Categorie form state
  const [catForm, setCatForm] = useState({ nome: '', tipo: 'entrata' as 'entrata' | 'uscita', colore: '#6366f1', note: '' })
  const [editingCat, setEditingCat] = useState<CategoriaContabile | null>(null)
  const [catModal, setCatModal] = useState(false)

  // Fornitori form state
  const [editingForn, setEditingForn] = useState<Fornitore | null>(null)
  const [fornModal, setFornModal] = useState(false)
  const [fornForm, setFornForm] = useState({ nome: '', partita_iva: '', indirizzo: '', telefono: '', email: '', note: '' })

  const navigate = useNavigate()
  const qc = useQueryClient()

  const handleSearch = (v: string) => {
    setRawSearch(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 300)
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: riepilogo } = useQuery({
    queryKey: ['contabilita-riepilogo', dal, al],
    queryFn: () => contabilitaApi.riepilogo({ dal: dal || undefined, al: al || undefined }),
  })

  const { data: movimenti = [], isLoading: loadingMovimenti } = useQuery({
    queryKey: ['movimenti', debouncedSearch, tipoFilter, dal, al],
    queryFn: () => contabilitaApi.listMovimenti({
      search: debouncedSearch || undefined,
      tipo: tipoFilter || undefined,
      dal: dal || undefined,
      al: al || undefined,
    }),
    enabled: tab === 'movimenti',
  })

  const { data: categorie = [], isLoading: loadingCat } = useQuery({
    queryKey: ['categorie'],
    queryFn: () => contabilitaApi.listCategorie(),
    enabled: tab === 'categorie' || tab === 'movimenti',
  })

  const { data: fornitori = [], isLoading: loadingForn } = useQuery({
    queryKey: ['fornitori'],
    queryFn: () => contabilitaApi.listFornitori(),
    enabled: tab === 'fornitori' || tab === 'movimenti',
  })

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const delMovimento = useMutation({
    mutationFn: (id: number) => contabilitaApi.deleteMovimento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimenti'] })
      qc.invalidateQueries({ queryKey: ['contabilita-riepilogo'] })
      toast.success('Movimento eliminato')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Errore durante l\'eliminazione'),
  })

  const saveCat = useMutation({
    mutationFn: (d: { id?: number; data: Omit<CategoriaContabile, 'id' | 'created_at'> }) =>
      d.id ? contabilitaApi.updateCategoria(d.id, d.data) : contabilitaApi.createCategoria(d.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorie'] })
      toast.success(editingCat ? 'Categoria aggiornata' : 'Categoria creata')
      setCatModal(false)
      setEditingCat(null)
      setCatForm({ nome: '', tipo: 'entrata', colore: '#6366f1', note: '' })
    },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  const delCat = useMutation({
    mutationFn: (id: number) => contabilitaApi.deleteCategoria(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorie'] })
      toast.success('Categoria eliminata')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Errore durante l\'eliminazione'),
  })

  const saveForn = useMutation({
    mutationFn: (d: { id?: number; data: Omit<Fornitore, 'id' | 'created_at'> }) =>
      d.id ? contabilitaApi.updateFornitore(d.id, d.data) : contabilitaApi.createFornitore(d.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornitori'] })
      toast.success(editingForn ? 'Fornitore aggiornato' : 'Fornitore creato')
      setFornModal(false)
      setEditingForn(null)
      setFornForm({ nome: '', partita_iva: '', indirizzo: '', telefono: '', email: '', note: '' })
    },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  const delForn = useMutation({
    mutationFn: (id: number) => contabilitaApi.deleteFornitore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornitori'] })
      toast.success('Fornitore eliminato')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Errore durante l\'eliminazione'),
  })

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleDeleteMovimento = (id: number) => {
    if (deleteConfirm === id) {
      delMovimento.mutate(id)
    } else {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const handleDeleteCat = (id: number) => {
    if (deleteConfirm === id) {
      delCat.mutate(id)
    } else {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const handleDeleteForn = (id: number) => {
    if (deleteConfirm === id) {
      delForn.mutate(id)
    } else {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const openNewCat = () => {
    setEditingCat(null)
    setCatForm({ nome: '', tipo: 'entrata', colore: '#6366f1', note: '' })
    setCatModal(true)
  }

  const openEditCat = (c: CategoriaContabile) => {
    setEditingCat(c)
    setCatForm({ nome: c.nome, tipo: c.tipo, colore: c.colore || '#6366f1', note: c.note || '' })
    setCatModal(true)
  }

  const openNewForn = () => {
    setEditingForn(null)
    setFornForm({ nome: '', partita_iva: '', indirizzo: '', telefono: '', email: '', note: '' })
    setFornModal(true)
  }

  const openEditForn = (f: Fornitore) => {
    setEditingForn(f)
    setFornForm({
      nome: f.nome,
      partita_iva: f.partita_iva || '',
      indirizzo: f.indirizzo || '',
      telefono: f.telefono || '',
      email: f.email || '',
      note: f.note || '',
    })
    setFornModal(true)
  }

  const saldo = riepilogo?.saldo ?? 0
  const saldoPositivo = saldo >= 0

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="text-indigo-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Contabilità</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gestione entrate e uscite parrocchiali</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="text-green-600" size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Entrate</p>
            <p className="text-xl font-bold text-green-600">{formatEur(riepilogo?.totale_entrate ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="text-red-600" size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Uscite</p>
            <p className="text-xl font-bold text-red-600">{formatEur(riepilogo?.totale_uscite ?? 0)}</p>
          </div>
        </div>
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${saldoPositivo ? 'bg-indigo-100' : 'bg-red-100'}`}>
            <Scale className={saldoPositivo ? 'text-indigo-600' : 'text-red-600'} size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Saldo</p>
            <p className={`text-xl font-bold ${saldoPositivo ? 'text-indigo-600' : 'text-red-600'}`}>{formatEur(saldo)}</p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['movimenti', 'categorie', 'fornitori'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setDeleteConfirm(null) }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Movimenti tab ── */}
      {tab === 'movimenti' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Cerca descrizione, n° documento..."
                value={rawSearch}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={tipoFilter}
              onChange={e => setTipoFilter(e.target.value)}
            >
              <option value="">Tutti i tipi</option>
              <option value="entrata">Entrate</option>
              <option value="uscita">Uscite</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Dal</label>
              <input
                type="date"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={dal}
                onChange={e => setDal(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Al</label>
              <input
                type="date"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={al}
                onChange={e => setAl(e.target.value)}
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <a
                href={contabilitaApi.exportExcelUrl(dal || undefined, al || undefined)}
                className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                download
              >
                <Download size={16} /> Esporta Excel
              </a>
              <button
                onClick={() => navigate('/contabilita/nuovo')}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} /> Nuovo Movimento
              </button>
            </div>
          </div>

          {loadingMovimenti ? (
            <div className="p-8 text-center text-gray-400">Caricamento...</div>
          ) : movimenti.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nessun movimento trovato</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Descrizione</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Fornitore</th>
                    <th className="px-4 py-3 font-medium text-right">Importo</th>
                    <th className="px-4 py-3 font-medium w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {movimenti.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{formatDate(m.data)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          m.tipo === 'entrata'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {m.tipo === 'entrata' ? 'Entrata' : 'Uscita'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{m.descrizione}</td>
                      <td className="px-4 py-3 text-gray-600">{m.categoria_nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.fornitore_nome ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        m.tipo === 'entrata' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {m.tipo === 'uscita' ? '−' : '+'}{formatEur(m.importo)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => navigate(`/contabilita/${m.id}/modifica`)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Modifica"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteMovimento(m.id)}
                            className={`p-1.5 rounded transition-colors ${
                              deleteConfirm === m.id
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={deleteConfirm === m.id ? 'Conferma eliminazione' : 'Elimina'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Categorie tab ── */}
      {tab === 'categorie' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-end">
            <button
              onClick={openNewCat}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> Nuova Categoria
            </button>
          </div>

          {loadingCat ? (
            <div className="p-8 text-center text-gray-400">Caricamento...</div>
          ) : categorie.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nessuna categoria</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Colore</th>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 font-medium w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {categorie.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className="inline-block w-5 h-5 rounded-full border border-gray-200"
                          style={{ backgroundColor: c.colore || '#9ca3af' }}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{c.nome}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          c.tipo === 'entrata' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {c.tipo === 'entrata' ? 'Entrata' : 'Uscita'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.note || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEditCat(c)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Modifica"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteCat(c.id)}
                            className={`p-1.5 rounded transition-colors ${
                              deleteConfirm === c.id
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={deleteConfirm === c.id ? 'Conferma eliminazione' : 'Elimina'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Fornitori tab ── */}
      {tab === 'fornitori' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-end">
            <button
              onClick={openNewForn}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> Nuovo Fornitore
            </button>
          </div>

          {loadingForn ? (
            <div className="p-8 text-center text-gray-400">Caricamento...</div>
          ) : fornitori.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nessun fornitore</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">P. IVA</th>
                    <th className="px-4 py-3 font-medium">Telefono</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {fornitori.map(f => (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{f.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{f.partita_iva || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{f.telefono || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{f.email || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEditForn(f)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Modifica"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteForn(f.id)}
                            className={`p-1.5 rounded transition-colors ${
                              deleteConfirm === f.id
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={deleteConfirm === f.id ? 'Conferma eliminazione' : 'Elimina'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Categoria Modal ── */}
      {catModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingCat ? 'Modifica Categoria' : 'Nuova Categoria'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={catForm.nome}
                  onChange={e => setCatForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Es. Offerte domenicali"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={catForm.tipo}
                  onChange={e => setCatForm(f => ({ ...f, tipo: e.target.value as 'entrata' | 'uscita' }))}
                >
                  <option value="entrata">Entrata</option>
                  <option value="uscita">Uscita</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colore</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 border border-gray-200 rounded-lg cursor-pointer"
                    value={catForm.colore}
                    onChange={e => setCatForm(f => ({ ...f, colore: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">{catForm.colore}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  rows={2}
                  value={catForm.note}
                  onChange={e => setCatForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => { setCatModal(false); setEditingCat(null) }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={() => saveCat.mutate({ id: editingCat?.id, data: catForm })}
                disabled={!catForm.nome || saveCat.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveCat.isPending ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fornitore Modal ── */}
      {fornModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingForn ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={fornForm.nome}
                  onChange={e => setFornForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ragione sociale o nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partita IVA</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={fornForm.partita_iva}
                  onChange={e => setFornForm(f => ({ ...f, partita_iva: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={fornForm.telefono}
                  onChange={e => setFornForm(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={fornForm.email}
                  onChange={e => setFornForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={fornForm.indirizzo}
                  onChange={e => setFornForm(f => ({ ...f, indirizzo: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  rows={2}
                  value={fornForm.note}
                  onChange={e => setFornForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => { setFornModal(false); setEditingForn(null) }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={() => saveForn.mutate({ id: editingForn?.id, data: fornForm })}
                disabled={!fornForm.nome || saveForn.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveForn.isPending ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
