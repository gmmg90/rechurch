import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, Plus, Pencil, Trash2 } from 'lucide-react'
import { scadenziarioApi, type CategoriaEvento } from '../../api/client'

interface Props { onClose: () => void }

export default function GestisciCategorie({ onClose }: Props) {
  const qc = useQueryClient()
  const [editId, setEditId] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [colore, setColore] = useState('#6366f1')
  const [showForm, setShowForm] = useState(false)

  const { data: categorie = [] } = useQuery({
    queryKey: ['scadenziario-categorie'],
    queryFn: scadenziarioApi.listCategorie,
  })

  const saveMut = useMutation({
    mutationFn: () => editId
      ? scadenziarioApi.updateCategoria(editId, { nome, colore })
      : scadenziarioApi.createCategoria({ nome, colore }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scadenziario-categorie'] })
      toast.success(editId ? 'Categoria aggiornata' : 'Categoria creata')
      resetForm()
    },
    onError: () => toast.error('Errore'),
  })

  const deleteMut = useMutation({
    mutationFn: scadenziarioApi.deleteCategoria,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scadenziario-categorie'] })
      toast.success('Categoria eliminata')
    },
    onError: () => toast.error('Errore'),
  })

  function startEdit(c: CategoriaEvento) {
    setEditId(c.id); setNome(c.nome); setColore(c.colore); setShowForm(true)
  }

  function resetForm() {
    setEditId(null); setNome(''); setColore('#6366f1'); setShowForm(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Categorie eventi</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-3">
          {categorie.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: c.colore }} />
              <span className="flex-1 text-sm text-gray-800">{c.nome}</span>
              <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Pencil size={14} /></button>
              <button onClick={() => deleteMut.mutate(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
            </div>
          ))}
          {categorie.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Nessuna categoria</p>}

          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
              <Plus size={14} /> Nuova categoria
            </button>
          ) : (
            <form onSubmit={e => { e.preventDefault(); saveMut.mutate() }} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input type="color" value={colore} onChange={e => setColore(e.target.value)} className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome categoria"
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button type="submit" disabled={saveMut.isPending} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saveMut.isPending ? '...' : editId ? 'Salva' : 'Crea'}
              </button>
              <button type="button" onClick={resetForm} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Annulla</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
