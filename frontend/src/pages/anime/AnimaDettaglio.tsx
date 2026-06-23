import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Droplets, Cookie, Star, Heart, FileText, FileDown, User, MapPin, Calendar,
} from 'lucide-react'
import { animeApi, pdfApi, type Battesimo, type Comunione, type Cresima, type Matrimonio } from '../../api/client'
import { formatDate } from '../../utils/date'

function SacramentoCard({
  icon: Icon, color, badge, title, subtitle, certificatoUrl, pdfUrl,
}: {
  icon: React.ElementType
  color: string
  badge: string
  title: string
  subtitle: string
  certificatoUrl: string
  pdfUrl: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="text-white" size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{badge}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link
          to={certificatoUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          title="Visualizza certificato"
        >
          <FileText size={13} /> Vedi
        </Link>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          title="Scarica PDF"
        >
          <FileDown size={13} /> PDF
        </a>
      </div>
    </div>
  )
}

export default function AnimaDettaglio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['anima', id],
    queryFn: () => animeApi.get(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="p-12 text-center text-gray-400">Caricamento…</div>
  if (error || !data) return <div className="p-12 text-center text-red-500">Anima non trovata</div>

  const totalSacramenti = data.battesimi.length + data.comunioni.length + data.cresime.length + data.matrimoni.length

  return (
    <div className="p-8 max-w-5xl">
      <button
        onClick={() => navigate('/anime')}
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-6"
      >
        <ChevronLeft size={16} /> Anime
      </button>

      {/* Header anima */}
      <div className="bg-gradient-to-br from-violet-500 to-violet-700 text-white rounded-2xl p-6 mb-6 shadow-md">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
            <User size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {data.cognome} {data.nome}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-violet-100 text-sm">
              {data.data_nascita && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} /> Nato/a il {formatDate(data.data_nascita)}
                </span>
              )}
              {data.luogo_nascita && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} /> {data.luogo_nascita}
                </span>
              )}
            </div>
            <p className="text-violet-100 text-sm mt-3">
              <strong>{totalSacramenti}</strong> sacramento/i registrato/i in archivio
            </p>
          </div>
        </div>
      </div>

      {/* Sacramenti */}
      {totalSacramenti === 0 ? (
        <div className="text-center text-gray-400 py-12">Nessun sacramento registrato per questa anima.</div>
      ) : (
        <div className="space-y-6">
          {data.battesimi.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="text-blue-500" size={18} />
                <h2 className="font-semibold text-gray-700">Battesimi ({data.battesimi.length})</h2>
              </div>
              <div className="space-y-2">
                {data.battesimi.map((b: Battesimo) => (
                  <SacramentoCard
                    key={b.id}
                    icon={Droplets}
                    color="bg-blue-500"
                    badge="Battesimo"
                    title={`${formatDate(b.data_battesimo)} — ${b.luogo_battesimo ?? '—'}`}
                    subtitle={`Ministro: ${b.ministro ?? '—'} | Reg.: ${b.numero_registro ?? '—'}`}
                    certificatoUrl={`/battesimi/${b.id}/certificato`}
                    pdfUrl={pdfApi.battesimoUrl(b.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {data.comunioni.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Cookie className="text-emerald-500" size={18} />
                <h2 className="font-semibold text-gray-700">Comunioni ({data.comunioni.length})</h2>
              </div>
              <div className="space-y-2">
                {data.comunioni.map((co: Comunione) => (
                  <SacramentoCard
                    key={co.id}
                    icon={Cookie}
                    color="bg-emerald-500"
                    badge="Comunione"
                    title={`${formatDate(co.data_comunione)} — ${co.luogo_comunione ?? '—'}`}
                    subtitle={`Ministro: ${co.ministro ?? '—'} | Reg.: ${co.numero_registro ?? '—'}`}
                    certificatoUrl={`/comunioni/${co.id}/certificato`}
                    pdfUrl={pdfApi.comunioneUrl(co.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {data.cresime.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Star className="text-amber-500" size={18} />
                <h2 className="font-semibold text-gray-700">Cresime ({data.cresime.length})</h2>
              </div>
              <div className="space-y-2">
                {data.cresime.map((c: Cresima) => (
                  <SacramentoCard
                    key={c.id}
                    icon={Star}
                    color="bg-amber-500"
                    badge="Cresima"
                    title={`${formatDate(c.data_cresima)} — ${c.luogo_cresima ?? '—'}`}
                    subtitle={`Vescovo: ${c.vescovo ?? '—'} | Reg.: ${c.numero_registro ?? '—'}`}
                    certificatoUrl={`/cresime/${c.id}/certificato`}
                    pdfUrl={pdfApi.cresimaUrl(c.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {data.matrimoni.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="text-rose-500" size={18} />
                <h2 className="font-semibold text-gray-700">Matrimoni ({data.matrimoni.length})</h2>
              </div>
              <div className="space-y-2">
                {data.matrimoni.map((m: Matrimonio) => (
                  <SacramentoCard
                    key={m.id}
                    icon={Heart}
                    color="bg-rose-500"
                    badge="Matrimonio"
                    title={`${m.sposo_nome} ${m.sposo_cognome} + ${m.sposa_nome} ${m.sposa_cognome}`}
                    subtitle={`${formatDate(m.data_matrimonio)} — ${m.luogo_matrimonio ?? '—'} | Reg.: ${m.numero_registro ?? '—'}`}
                    certificatoUrl={`/matrimoni/${m.id}/certificato`}
                    pdfUrl={pdfApi.matrimonioUrl(m.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
