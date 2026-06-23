import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { comunioniApi, type Comunione } from '../../api/client'

type FormData = Omit<Comunione, 'id' | 'created_at' | 'updated_at'>

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

export default function ComunioneForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = Boolean(id)

  const { data: existing } = useQuery({
    queryKey: ['comunione', id],
    queryFn: () => comunioniApi.get(Number(id)),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  useEffect(() => {
    if (existing) reset(existing)
  }, [existing, reset])

  const create = useMutation({
    mutationFn: comunioniApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comunioni'] }); navigate('/comunioni') },
  })
  const update = useMutation({
    mutationFn: (data: FormData) => comunioniApi.update(Number(id), data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comunioni'] }); navigate('/comunioni') },
  })

  const onSubmit = (data: FormData) => {
    if (isEdit) update.mutate(data)
    else create.mutate(data)
  }

  const isPending = create.isPending || update.isPending

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => navigate('/comunioni')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-6">
        <ChevronLeft size={16} /> Comunioni
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isEdit ? 'Modifica Comunione' : 'Nuova Comunione'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome *" error={errors.nome?.message}>
            <input {...register('nome', { required: 'Campo obbligatorio' })} className={inputCls} />
          </Field>
          <Field label="Cognome *" error={errors.cognome?.message}>
            <input {...register('cognome', { required: 'Campo obbligatorio' })} className={inputCls} />
          </Field>
          <Field label="Data di nascita">
            <input type="date" {...register('data_nascita')} className={inputCls} />
          </Field>
          <Field label="Luogo di nascita">
            <input {...register('luogo_nascita')} className={inputCls} />
          </Field>
        </div>

        <hr className="border-gray-100" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data comunione *" error={errors.data_comunione?.message}>
            <input type="date" {...register('data_comunione', { required: 'Campo obbligatorio' })} className={inputCls} />
          </Field>
          <Field label="Luogo comunione">
            <input {...register('luogo_comunione')} className={inputCls} />
          </Field>
          <Field label="Ministro">
            <input {...register('ministro')} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="N. Registro">
              <input {...register('numero_registro')} className={inputCls} />
            </Field>
            <Field label="Anno registro">
              <input type="number" {...register('anno_registro', { valueAsNumber: true })} className={inputCls} />
            </Field>
          </div>
        </div>

        <hr className="border-gray-100" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome padre">
            <input {...register('padre_nome')} className={inputCls} />
          </Field>
          <Field label="Nome madre">
            <input {...register('madre_nome')} className={inputCls} />
          </Field>
        </div>

        <Field label="Note">
          <textarea {...register('note')} rows={3} className={inputCls} />
        </Field>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={() => navigate('/comunioni')} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annulla
          </button>
          <button type="submit" disabled={isPending} className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
            {isPending ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  )
}
