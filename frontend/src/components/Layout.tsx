import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useModuli } from '../contexts/ModuliContext'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  segreteria: 'Segreteria',
  economo: 'Economo',
  lettura: 'Sola lettura',
}

const ALL_NAV_ITEMS = [
  { to: '/',            label: 'Dashboard',        icon: Home,        end: true,  modulo: null },
  { to: '/battesimi',   label: 'Battesimi',         icon: Droplets,    end: false, modulo: 'battesimi' },
  { to: '/comunioni',   label: 'Comunioni',         icon: Wheat,       end: false, modulo: 'comunioni' },
  { to: '/cresime',     label: 'Cresime',           icon: Star,        end: false, modulo: 'cresime' },
  { to: '/matrimoni',   label: 'Matrimoni',         icon: Heart,       end: false, modulo: 'matrimoni' },
  { to: '/rubrica',     label: 'Rubrica',           icon: BookOpen,    end: false, modulo: 'rubrica' },
  { to: '/contabilita', label: 'Contabilità',       icon: Wallet,      end: false, modulo: 'contabilita' },
  { to: '/scanner',     label: 'Scanner Docs',      icon: ScanLine,    end: false, modulo: 'scanner' },
  { to: '/scadenziario',label: 'Scadenziario',      icon: CalendarDays,end: false, modulo: 'scadenziario' },
  { to: '/certificati', label: 'Modelli Certif.',   icon: FileText,    end: false, modulo: 'certificati' },
  { to: '/importa',     label: 'Importa Dati',      icon: Upload,      end: false, modulo: 'importa' },
  { to: '/impostazioni',label: 'Impostazioni',      icon: Settings,    end: false, modulo: null },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { moduli, isLoading: moduliLoading } = useModuli()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const navItems = [
    ...ALL_NAV_ITEMS.filter(item => {
      if (!item.modulo) return true
      if (moduliLoading) return true
      return moduli[item.modulo] !== false
    }),
    ...(user?.ruolo === 'admin'
      ? [
          { to: '/utenti',         label: 'Utenti',          icon: Users,       end: false, modulo: null },
          { to: '/amministrazione',label: 'Amministrazione', icon: ShieldCheck, end: false, modulo: null },
        ]
      : []),
  ]

  const initials = user
    ? `${user.nome.charAt(0)}${user.cognome.charAt(0)}`.toUpperCase()
    : '?'

  const roleLabel = user ? (ROLE_LABELS[user.ruolo] ?? user.ruolo) : ''

  return (
    <div className="flex h-screen bg-gray-50">
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
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-indigo-900 flex flex-col transform transition-transform duration-200 md:static md:translate-x-0 ${
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
        <header className="md:hidden flex items-center gap-3 bg-indigo-900 text-white px-4 py-3 sticky top-0 z-20">
          <button onClick={() => setDrawerOpen(true)} aria-label="Apri menu">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Church className="text-indigo-300" size={22} />
            <span className="font-bold text-lg">ReChurch</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
