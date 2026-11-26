import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Church,
  Home,
  Droplets,
  Star,
  Heart,
  Upload,
  Settings,
  Users,
  LogOut,
  BookOpen,
  Wallet,
  CalendarDays,
  ScanLine,
  ShieldCheck,
  Wheat,
  FileText,
  ClipboardCheck,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useChiese } from './ChiesaSelect'
import { useAuth } from '../contexts/AuthContext'
import { useModuli } from '../contexts/ModuliContext'
import { verificheApi } from '../api/client'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  segreteria: 'Segreteria',
  economo: 'Economo',
  lettura: 'Sola lettura',
}

const ALL_NAV_ITEMS = [
  { to: '/',            label: 'Dashboard',        icon: Home,        end: true,  modulo: null,          desktopOnly: false },
  { to: '/battesimi',   label: 'Battesimi',         icon: Droplets,    end: false, modulo: 'battesimi',    desktopOnly: false },
  { to: '/comunioni',   label: 'Comunioni',         icon: Wheat,       end: false, modulo: 'comunioni',    desktopOnly: false },
  { to: '/cresime',     label: 'Cresime',           icon: Star,        end: false, modulo: 'cresime',      desktopOnly: false },
  { to: '/matrimoni',   label: 'Matrimoni',         icon: Heart,       end: false, modulo: 'matrimoni',    desktopOnly: false },
  { to: '/rubrica',     label: 'Rubrica',           icon: BookOpen,    end: false, modulo: 'rubrica',      desktopOnly: false },
  { to: '/contabilita', label: 'Contabilità',       icon: Wallet,      end: false, modulo: 'contabilita',  desktopOnly: false },
  { to: '/scanner',     label: 'Scanner Docs',      icon: ScanLine,    end: false, modulo: 'scanner',      desktopOnly: false },
  { to: '/scadenziario',label: 'Scadenziario',      icon: CalendarDays,end: false, modulo: 'scadenziario', desktopOnly: false },
  // Attività "da scrivania": nascoste su mobile per uno smartphone più snello
  { to: '/certificati', label: 'Modelli Certif.',   icon: FileText,    end: false, modulo: 'certificati',  desktopOnly: true },
  { to: '/importa',     label: 'Importa Dati',      icon: Upload,      end: false, modulo: 'importa',      desktopOnly: true },
  { to: '/verifiche',   label: 'Da verificare',     icon: ClipboardCheck, end: false, modulo: 'verifiche', desktopOnly: true },
  { to: '/impostazioni',label: 'Impostazioni',      icon: Settings,    end: false, modulo: null,           desktopOnly: true },
]

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

const PAGINE_PARROCCHIA = ['/rubrica', '/certificati', '/importa', '/impostazioni']

// Barra in basso su telefono: le sezioni usate tutti i giorni, il resto nel menu
const TAB_BAR = [
  { to: '/',             label: 'Home',     icon: Home,         end: true,  modulo: null },
  { to: '/rubrica',      label: 'Rubrica',  icon: BookOpen,     end: false, modulo: 'rubrica' },
  { to: '/scadenziario', label: 'Agenda',   icon: CalendarDays, end: false, modulo: 'scadenziario' },
  { to: '/contabilita',  label: 'Conti',    icon: Wallet,       end: false, modulo: 'contabilita' },
]

const TITOLI: [string, string][] = [
  ['/battesimi', 'Battesimi'], ['/comunioni', 'Comunioni'], ['/cresime', 'Cresime'],
  ['/matrimoni', 'Matrimoni'], ['/rubrica', 'Rubrica'], ['/contabilita', 'Contabilità'],
  ['/scanner', 'Scanner'], ['/scadenziario', 'Scadenziario'], ['/certificati', 'Modelli'],
  ['/importa', 'Importa dati'], ['/verifiche', 'Da verificare'], ['/impostazioni', 'Impostazioni'],
  ['/utenti', 'Utenti'], ['/amministrazione', 'Amministrazione'],
]

export default function Layout() {
  const { user, logout, chiesaUtente } = useAuth()
  // Per un utente limitato l'API restituisce solo la sua chiesa
  const { data: chiese = [] } = useChiese()
  const { moduli, isLoading: moduliLoading } = useModuli()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { data: verifiche } = useQuery({
    queryKey: ['verifiche-conteggio'],
    queryFn: verificheApi.conteggio,
    enabled: !isMobile && moduli['verifiche'] !== false,
    staleTime: 5 * 60_000,
  })

  // Close the mobile drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const navItems = [
    ...ALL_NAV_ITEMS.filter(item => {
      if (isMobile && item.desktopOnly) return false   // snello su mobile
      // Utenti di una singola chiesa: niente pagine di tutta la parrocchia
      if (chiesaUtente !== null && PAGINE_PARROCCHIA.includes(item.to)) return false
      if (!item.modulo) return true
      if (moduliLoading) return true
      return moduli[item.modulo] !== false
    }),
    // Utenti e Amministrazione: solo admin, e solo su desktop (nascoste su mobile)
    ...(user?.ruolo === 'admin' && !isMobile
      ? [
          { to: '/utenti',         label: 'Utenti',          icon: Users,       end: false, modulo: null, desktopOnly: true },
          { to: '/amministrazione',label: 'Amministrazione', icon: ShieldCheck, end: false, modulo: null, desktopOnly: true },
        ]
      : []),
  ]

  const initials = user
    ? `${user.nome.charAt(0)}${user.cognome.charAt(0)}`.toUpperCase()
    : '?'

  const roleLabel = user ? (ROLE_LABELS[user.ruolo] ?? user.ruolo) : ''

  const tabs = TAB_BAR.filter(t => {
    if (chiesaUtente !== null && PAGINE_PARROCCHIA.includes(t.to)) return false
    if (!t.modulo || moduliLoading) return true
    return moduli[t.modulo] !== false
  })
  const path = location.pathname
  const titolo = path === '/' ? null : (TITOLI.find(([p]) => path === p || path.startsWith(p + '/'))?.[1] ?? null)
  // Pagine di secondo livello (modifica, dettaglio, certificato): freccia indietro
  const sottopagina = path.split('/').filter(Boolean).length > 1

  return (
    <div className="flex h-[100dvh] bg-gray-50">
      {/* Backdrop (mobile only, when drawer open) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on desktop, slide-in drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 md:w-64 bg-indigo-900 flex flex-col pt-safe pb-safe md:pt-0 md:pb-0 transform transition-transform duration-200 md:static md:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-indigo-800">
          <div className="flex items-center gap-3">
            <Church className="text-indigo-300" size={28} />
            <span className="text-white font-bold text-xl tracking-tight">ReChurch</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="md:hidden text-indigo-300 hover:text-white"
            aria-label="Chiudi menu"
          >
            <X size={22} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-700 text-white border-l-2 border-indigo-300 pl-3.5'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white border-l-2 border-transparent pl-3.5'
                }`
              }
            >
              <Icon size={18} />
              {label}
              {to === '/verifiche' && (verifiche?.totale ?? 0) > 0 && (
                <span className="ml-auto text-xs bg-amber-400 text-amber-950 font-semibold rounded-full px-2 py-0.5">
                  {verifiche!.totale}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-indigo-800 space-y-3">
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">
                  {user.nome} {user.cognome}
                </p>
                <span className="inline-block text-xs bg-indigo-700 text-indigo-200 rounded px-1.5 py-0.5 mt-0.5">
                  {roleLabel}
                </span>
                {chiesaUtente !== null && chiese[0] && (
                  <p className="text-[11px] text-indigo-300 truncate mt-0.5" title="Vedi solo i dati di questa chiesa">
                    {chiese[0].nome}
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-indigo-300 hover:bg-indigo-800 hover:text-white text-sm transition-colors"
          >
            <LogOut size={16} />
            Esci
          </button>

          <p className="text-indigo-500 text-xs px-1">ReChurch v2.1</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden bg-indigo-900 text-white pt-safe sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-1 h-14 px-2">
            {sottopagina ? (
              <button onClick={() => navigate(-1)} aria-label="Indietro"
                className="w-11 h-11 flex items-center justify-center rounded-full active:bg-indigo-800">
                <ChevronLeft size={26} />
              </button>
            ) : (
              <div className="w-11 h-11 flex items-center justify-center">
                <Church className="text-indigo-300" size={22} />
              </div>
            )}
            <span className="flex-1 min-w-0 truncate font-semibold text-[17px] pr-3">
              {titolo ?? 'ReChurch'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto overscroll-contain pb-mobile-nav md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 pb-safe">
          <div className="flex">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium ${
                    isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                {({ isActive }) => (<>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                  {label}
                </>)}
              </NavLink>
            ))}
            <button onClick={() => setDrawerOpen(true)} aria-label="Apri menu"
              className="flex-1 flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium text-gray-500">
              <Menu size={22} strokeWidth={1.8} />
              Altro
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}
