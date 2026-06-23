import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { rubricaApi, type Famiglia } from '../../api/client'

type FormData = {
  nome: string
  cognome: string
  sesso?: string
  data_nascita?: string
  luogo_nascita?: string
  indirizzo?: string
  cap?: string
  citta?: string
  telefono?: string
  email?: string
  famiglia_id?: number
  note?: string
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

export default function PersonaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = Boolean(id)
  const [famigliaSearch, setFamigliaSearch] = useState('')
  const [showFamigliaDropdown, setShowFamigliaDropdown] = useState(false)
  const [selectedFamiglia, setSelectedFamiglia] = useState<Famiglia | null>(null)

  const { data: existing } = useQuery({
    queryKey: ['persona', id],
    queryFn: () => rubricaApi.getPersona(Number(id)),
    enabled: isEdit,
  })

  const { data: famiglie = [] } = useQuery({
    queryKey: ['famiglie', famigliaSearch],
    queryFn: () => rubricaApi.listFamiglie({ search: famigliaSearch || undefined, limit: 20 }),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (existing) {
      reset({
        nome: existing.nome,
        cognome: existing.cognome,
        sesso: existing.sesso ?? '',
        data_nascita: existing.data_nascita ?? '',
        luogo_nascita: existing.luogo_nascita ?? '',
        indirizzo: existing.indirizzo ?? '',
        cap: existing.cap ?? '',
        citta: existing.citta ?? '',
        telefono: existing.telefono ?? '',
        email: existing.email ?? '',
        famiglia_id: existing.famiglia_id ?? undefined,
        note: existing.note ?? '',
      })
      if (existing.famiglia_id && existing.famiglia_cognome) {
        setSelectedFamiglia({
          id: existing.famiglia_id,
          cognome: existing.famiglia_cognome,
        })
        setFamigliaSearch(existing.famiglia_cognome)
      }
    }
  }, [existing, reset])

  const create = useMutation({
    mutationFn: rubricaApi.createPersona,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['persone'] })
      toast.success('Persona creata')
      navigate(`/rubrica/persone/${data.id}`)
    },
    onError: () => toast.error('Errore durante la creazione'),
  })

  const update = useMutation({
    mutationFn: (data: FormData) => rubricaApi.updatePersona(Number(id), data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['persone'] })
      qc.invalidateQueries({ queryKey: ['persona', id] })
      toast.success('Persona aggiornata')
      navigate(`/rubrica/persone/${data.id}`)
    },
    onError: () => toast.error('Errore durante l\'aggiornamento'),
  })

  const onSubmit = (data: FormData) => {
    const payload = {
      ...data,
      famiglia_id: selectedFamiglia?.id ?? undefined,
      sesso: data.sesso || undefined,
      data_nascita: data.data_nascita || undefined,
      luogo_nascita: data.luogo_nascita || undefined,
      indirizzo: data.indirizzo || undefined,
      cap: data.cap || undefined,
      citta: data.citta || undefined,
      telefono: data.telefono || undefined,
      email: data.email || undefined,
      note: data.note || undefined,
    }
    if (isEdit) update.mutate(payload)
    else create.mutate(payload)
  }

  const isPending = create.isPending || update.isPending

  const handleFamigliaSelect = (f: Famiglia) => {
    setSelectedFamiglia(f)
    setFamigliaSearch(f.cognome)
    setValue('famiglia_id', f.id)
    setShowFamigliaDropdown(false)
  }

  const handleFamigliaClear = () => {
    setSelectedFamiglia(null)
    setFamigliaSearch('')
    setValue('famiglia_id', undefined)
  }

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => navigate('/rubrica')}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-6"
      >
        <ChevronLeft size={16} /> Rubrica
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {isEdit ? 'Modifica Persona' : 'Nuova Persona'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Nome e Cognome */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome *" error={errors.nome?.message}>
            <input {...register('nome', { required: 'Campo obbligatorio' })} className={inputCls} />
          </Field>
          <Field label="Cognome *" error={errors.cognome?.message}>
            <input {...register('cognome', { required: 'Campo obbligatorio' })} className={inputCls} />
          </Field>
        </div>

        {/* Sesso e nascita */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Sesso">
            <select {...register('sesso')} className={inputCls}>
              <option value="">—</option>
              <option value="M">Maschio</option>
              <option value="F">Femmina</option>
            </select>
          </Field>
          <Field label="Data di nascita">
            <input type="date" {...register('data_nascita')} className={inputCls} />
          </Field>
          <Field label="Luogo di nascita">
            <input {...register('luogo_nascita')} className={inputCls} />
          </Field>
        </div>

        <hr className="border-gray-100" />

        {/* Indirizzo */}
        <div className="grid grid-cols-1 gap-4">
          <Field label="Indirizzo">
            <input {...register('indirizzo')} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="CAP">
            <input {...register('cap')} className={inputCls} />
          </Field>
          <Field label="Città">
            <input {...register('citta')} className={`${inputCls} col-span-2`} />
          </Field>
        </div>

        <hr className="border-gray-100" />

        {/* Contatti */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Telefono">
            <input {...register('telefono')} className={inputCls} />
          </Field>
          <Field label="Email">
            <input type="email" {...register('email')} className={inputCls} />
          </Field>
        </div>

        <hr className="border-gray-100" />

        {/* Famiglia */}
        <Field label="Famiglia">
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className={inputCls}
                  placeholder="Cerca famiglia per cognome..."
                  value={famigliaSearch}
                  onChange={e => {
                    setFamigliaSearch(e.target.value)
                    setSelectedFamiglia(null)
                    setValue('famiglia_id', undefined)
                    setShowFamigliaDropdown(true)
                  }}
                  onFocus={() => setShowFamigliaDropdown(true)}
                  onBlur={() => setTimeout(() => setShowFamigliaDropdown(false), 200)}
                />
                {showFamigliaDropdown && famiglie.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {famiglie.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        onMouseDown={() => handleFamigliaSelect(f)}
                      >
                        Fam. {f.cognome}
                        {f.citta && <span className="text-gray-400 ml-2">— {f.citta}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedFamiglia && (
                <button
                  type="button"
                  onClick={handleFamigliaClear}
                  className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Rimuovi
                </button>
              )}
            </div>
            {selectedFamiglia && (
              <p className="text-xs text-indigo-600 mt-1">
                Famiglia selezionata: Fam. {selectedFamiglia.cognome}
              </p>
            )}
          </div>
        </Field>

        {/* Note */}
        <Field label="Note">
          <textarea {...register('note')} rows={3} className={inputCls} />
        </Field>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => navigate('/rubrica')}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {isPending ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  )
}
