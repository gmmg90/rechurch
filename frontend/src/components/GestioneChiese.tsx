import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Church, Plus, Pencil, Trash2, Star, Link2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { chieseApi, type Chiesa } from '../api/client'
import { useChiese } from './ChiesaSelect'

type Bozza = { nome: string; indirizzo: string; citta: string }
const vuota: Bozza = { nome: '', indirizzo: '', citta: '' }

// Dati usati nell'intestazione e nella firma dei certificati della chiesa
const CAMPI_EXTRA = [
  { k: 'cap', label: 'CAP' },
  { k: 'provincia', label: 'Provincia' },
  { k: 'telefono', label: 'Telefono' },
  { k: 'email', label: 'Email' },
  { k: 'rettore', label: 'Rettore / responsabile (firma dei certificati)' },
] as const
type Extra = Record<(typeof CAMPI_EXTRA)[number]['k'], string>

const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function errore(e: unknown, fallback: string) {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

/** Sezione "Chiese della parrocchia" della pagina Impostazioni. */
export default function GestioneChiese() {
  const qc = useQueryClient()
  const { data: chiese = [], isLoading } = useChiese()
  const [nuova, setNuova] = useState<Bozza>(vuota)
  const [modifica, setModifica] = useState<({ id: number } & Bozza & Extra) | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['chiese'] })

  const crea = useMutation({
    mutationFn: () => chieseApi.create({
      nome: nuova.nome.trim(),
      indirizzo: nuova.indirizzo.trim() || null,
      citta: nuova.citta.trim() || null,
    }),
    onSuccess: (c) => { refresh(); setNuova(vuota); toast.success(`Aggiunta "${c.nome}"`) },
    onError: (e) => toast.error(errore(e, 'Errore nel salvataggio (serve il ruolo amministratore)')),
  })

  const aggiorna = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Chiesa>) => chieseApi.update(id, data),
    onSuccess: () => { refresh(); setModifica(null) },
    onError: (e) => toast.error(errore(e, 'Errore nel salvataggio')),
  })

  const elimina = useMutation({
    mutationFn: (c: Chiesa) => chieseApi.delete(c.id),
    onSuccess: (_d, c) => { refresh(); toast.success(`Eliminata "${c.nome}"`) },
    onError: (e) => toast.error(errore(e, 'Impossibile eliminare la chiesa')),
  })

  const assegna = useMutation({
    mutationFn: (c: Chiesa) => chieseApi.assegnaSacramenti(c.id),
    onSuccess: (r) => {
      refresh()
      ;['battesimi', 'comunioni', 'cresime', 'matrimoni'].forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      const tot = r.battesimi + r.comunioni + r.cresime + r.matrimoni
      toast.success(`${tot.toLocaleString('it-IT')} sacramenti collegati a "${r.chiesa}"`)
    },
    onError: (e) => toast.error(errore(e, 'Operazione non riuscita')),
  })

  const utilizzo = (c: Chiesa) =>
    (c.battesimi ?? 0) + (c.comunioni ?? 0) + (c.cresime ?? 0) + (c.matrimoni ?? 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Church size={16} className="text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-700">Chiese della parrocchia</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Chiesa parrocchiale, chiese sussidiarie, rettorie e cappelle. Nei sacramenti puoi indicare
        in quale chiesa sono stati celebrati: il nome compila il luogo stampato sul certificato.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-400">Caricamento...</p>
      ) : chiese.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">Nessuna chiesa configurata.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl mb-4">
          {chiese.map(c => modifica?.id === c.id ? (
            <li key={c.id} className="p-3 space-y-2 bg-indigo-50/40">
              <input className={inputCls} value={modifica.nome} placeholder="Nome"
                onChange={e => setModifica({ ...modifica, nome: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className={inputCls} value={modifica.indirizzo} placeholder="Indirizzo"
                  onChange={e => setModifica({ ...modifica, indirizzo: e.target.value })} />
                <input className={inputCls} value={modifica.citta} placeholder="Città"
                  onChange={e => setModifica({ ...modifica, citta: e.target.value })} />
                {CAMPI_EXTRA.map(({ k, label }) => (
                  <input key={k} className={`${inputCls} ${k === 'rettore' ? 'sm:col-span-2' : ''}`}
                    value={modifica[k]} placeholder={label}
                    onChange={e => setModifica({ ...modifica, [k]: e.target.value })} />
                ))}
              </div>
              {!c.principale && (
                <p className="text-[11px] text-gray-500">
                  I certificati dei sacramenti celebrati qui riportano nome, indirizzo e contatti della chiesa;
                  se indichi il rettore, firma lui. I campi vuoti usano i dati della parrocchia.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModifica(null)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                  <X size={13} /> Annulla
                </button>
                <button
                  disabled={!modifica.nome.trim() || aggiorna.isPending}
                  onClick={() => aggiorna.mutate({
                    id: c.id,
                    nome: modifica.nome.trim(),
                    indirizzo: modifica.indirizzo.trim() || null,
                    citta: modifica.citta.trim() || null,
                    ...Object.fromEntries(CAMPI_EXTRA.map(({ k }) => [k, modifica[k].trim() || null])),
                  })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  <Check size={13} /> Salva
                </button>
              </div>
            </li>
          ) : (
            <li key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${c.attiva ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                  {c.nome}
                  {c.principale && (
                    <span className="ml-2 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 no-underline">
                      parrocchiale
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {[c.indirizzo, c.citta].filter(Boolean).join(', ') || '—'}
                  {c.rettore ? ` · ${c.rettore}` : ''}
                  {' · '}{utilizzo(c).toLocaleString('it-IT')} {utilizzo(c) === 1 ? 'sacramento' : 'sacramenti'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {!c.principale && (
                  <button title="Imposta come chiesa parrocchiale"
                    onClick={() => aggiorna.mutate({ id: c.id, principale: true })}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                    <Star size={15} />
                  </button>
                )}
                <button title="Collega i sacramenti senza chiesa a questa chiesa"
                  onClick={() => {
                    if (confirm(`Collegare a "${c.nome}" tutti i sacramenti che non hanno ancora una chiesa?\nIl loro luogo verrà impostato a "${c.nome}".`)) assegna.mutate(c)
                  }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                  <Link2 size={15} />
                </button>
                <button title="Modifica"
                  onClick={() => setModifica({
                    id: c.id, nome: c.nome, indirizzo: c.indirizzo ?? '', citta: c.citta ?? '',
                    cap: c.cap ?? '', provincia: c.provincia ?? '', telefono: c.telefono ?? '',
                    email: c.email ?? '', rettore: c.rettore ?? '',
                  })}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => aggiorna.mutate({ id: c.id, attiva: !c.attiva })}
                  className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50">
                  {c.attiva ? 'Disattiva' : 'Riattiva'}
                </button>
                {utilizzo(c) === 0 && (
                  <button title="Elimina"
                    onClick={() => { if (confirm(`Eliminare "${c.nome}"?`)) elimina.mutate(c) }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={e => { e.preventDefault(); if (nuova.nome.trim()) crea.mutate() }}
        className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.5fr_auto] gap-2"
      >
        <input className={inputCls} placeholder="Nome nuova chiesa" value={nuova.nome}
          onChange={e => setNuova({ ...nuova, nome: e.target.value })} />
        <input className={inputCls} placeholder="Indirizzo" value={nuova.indirizzo}
          onChange={e => setNuova({ ...nuova, indirizzo: e.target.value })} />
        <input className={inputCls} placeholder="Città" value={nuova.citta}
          onChange={e => setNuova({ ...nuova, citta: e.target.value })} />
        <button type="submit" disabled={!nuova.nome.trim() || crea.isPending}
          className="flex items-center justify-center gap-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          <Plus size={15} /> Aggiungi
        </button>
      </form>
    </div>
  )
}
