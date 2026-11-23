import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { erroreApi } from '../../utils/date'
import { ChiesaField, chiesaIdValue, hintNumero, useProssimoNumero } from '../../components/ChiesaSelect'
import { cresimeApi, type Cresima } from '../../api/client'

type FormData = Omit<Cresima, 'id' | 'created_at' | 'updated_at'>

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

export default function CresimaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  // Se arrivo dalla pagina "Da verificare" ci torno dopo il salvataggio
  const backTo = (useLocation().state as { from?: string } | null)?.from ?? '/cresime'
  const qc = useQueryClient()
  const isEdit = Boolean(id)

  const { data: existing } = useQuery({
    queryKey: ['cresima', id],
    queryFn: () => cresimeApi.get(Number(id)),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, setValue, getValues, watch, formState: { errors } } = useForm<FormData>()
  // Anteprima del numero che verrà assegnato nel registro (chiesa + anno)
  const [wChiesa, wData, wAnno, wNumero] = watch(['chiesa_id', 'data_cresima', 'anno_registro', 'numero_registro'])
  const prossimo = useProssimoNumero('cresime', wChiesa, wData, wAnno)

  useEffect(() => {
    if (existing) reset(existing)
  }, [existing, reset])

  const create = useMutation({
    mutationFn: cresimeApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cresime'] }); navigate(backTo) },
    onError: (e) => toast.error(erroreApi(e, 'Errore nel salvataggio')),
  })
  const update = useMutation({
    mutationFn: (data: FormData) => cresimeApi.update(Number(id), data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cresime'] }); navigate(backTo) },
    onError: (e) => toast.error(erroreApi(e, 'Errore nel salvataggio')),
  })

  const onSubmit = (data: FormData) => {
    if (isEdit) update.mutate(data)
    else create.mutate(data)
  }

  const isPending = create.isPending || update.isPending

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <button onClick={() => navigate(backTo)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-6">
        <ChevronLeft size={16} /> Cresime
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isEdit ? 'Modifica Cresima' : 'Nuova Cresima'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Data cresima *" error={errors.data_cresima?.message}>
            <input type="date" {...register('data_cresima', { required: 'Campo obbligatorio' })} className={inputCls} />
          </Field>
          <ChiesaField
            registration={register('chiesa_id', { setValueAs: chiesaIdValue })}
            preseleziona={!isEdit}
            onSelect={(c, auto) => {
              if (auto && isEdit) return  // in modifica si tiene la chiesa salvata
              setValue('chiesa_id', c?.id ?? null)
              if (c && (!auto || !getValues('luogo_cresima'))) setValue('luogo_cresima', c.nome, { shouldValidate: !auto })
            }}
            className={inputCls}
          />
          <Field label="Luogo cresima *" error={errors.luogo_cresima?.message}>
            <input {...register('luogo_cresima', { required: 'Campo obbligatorio' })} className={inputCls} />
          </Field>
          <Field label="Ministro">
            <input {...register('ministro')} className={inputCls} />
          </Field>
          <Field label="Vescovo">
            <input {...register('vescovo')} className={inputCls} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="N. Registro">
              <input
                {...register('numero_registro')}
                placeholder={prossimo.numero !== undefined ? `auto: ${prossimo.numero}` : 'automatico'}
                className={inputCls}
              />
              {!String(wNumero ?? '').trim() && (
                <p className="text-[11px] text-gray-400 mt-1">{hintNumero(prossimo.numero, prossimo.anno)}</p>
              )}
            </Field>
            <Field label="Anno registro">
              <input type="number" {...register('anno_registro', { valueAsNumber: true })} className={inputCls} />
            </Field>
          </div>
        </div>

        <hr className="border-gray-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome padre">
            <input {...register('padre_nome')} className={inputCls} />
          </Field>
          <Field label="Nome madre">
            <input {...register('madre_nome')} className={inputCls} />
          </Field>
          <Field label="Padrino">
            <input {...register('padrino_nome')} className={inputCls} />
          </Field>
          <Field label="Madrina">
            <input {...register('madrina_nome')} className={inputCls} />
          </Field>
        </div>

        <Field label="Note">
          <textarea {...register('note')} rows={3} className={inputCls} />
        </Field>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={() => navigate(backTo)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
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
