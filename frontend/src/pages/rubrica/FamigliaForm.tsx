import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { rubricaApi } from '../../api/client'

type FormData = {
  cognome: string
  indirizzo?: string
  cap?: string
  citta?: string
  telefono?: string
  note?: string
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function Field({ label, error, children, className = '' }: {
  label: string; error?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

/** Nuova famiglia: dopo il salvataggio si apre la scheda, dove si aggiungono i membri. */
export default function FamigliaForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>()

  const create = useMutation({
    mutationFn: (d: FormData) =>
      rubricaApi.createFamiglia({
        cognome: d.cognome.trim(),
        indirizzo: d.indirizzo || undefined,
        cap: d.cap || undefined,
        citta: d.citta || undefined,
        telefono: d.telefono || undefined,
        note: d.note || undefined,
      }),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ['famiglie'] })
      toast.success('Famiglia creata: ora puoi aggiungere i membri')
      navigate(`/rubrica/famiglie/${f.id}`, { replace: true })
    },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <button
        onClick={() => navigate('/rubrica?tab=famiglie')}
        className="hidden md:flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-6"
      >
        <ChevronLeft size={16} /> Rubrica
      </button>
      <h1 className="hidden md:block text-2xl font-bold text-gray-800 mb-6">Nuova Famiglia</h1>

      <form
        onSubmit={handleSubmit(d => create.mutate(d))}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-5"
      >
        <Field label="Cognome della famiglia *" error={errors.cognome?.message}>
          <input
            {...register('cognome', { required: 'Campo obbligatorio', validate: v => v.trim() !== '' || 'Campo obbligatorio' })}
            className={inputCls}
            placeholder="Es. Rossi"
            autoFocus
          />
        </Field>

        <Field label="Indirizzo">
          <input {...register('indirizzo')} className={inputCls} placeholder="Via, numero civico" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="CAP">
            <input {...register('cap')} className={inputCls} inputMode="numeric" maxLength={5} />
          </Field>
          <Field label="Città" className="col-span-2">
            <input {...register('citta')} className={inputCls} />
          </Field>
        </div>

        <Field label="Telefono">
          <input {...register('telefono')} className={inputCls} type="tel" inputMode="tel" />
        </Field>

        <Field label="Note">
          <textarea {...register('note')} rows={3} className={inputCls} />
        </Field>

        <p className="text-xs text-gray-500">
          Dopo il salvataggio si apre la scheda della famiglia, dove puoi aggiungere i membri dalla rubrica.
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-11 sm:h-auto px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="h-11 sm:h-auto px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {create.isPending ? 'Salvataggio...' : 'Crea famiglia'}
          </button>
        </div>
      </form>
    </div>
  )
}
