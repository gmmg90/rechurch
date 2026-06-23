import { NavLink, Outlet } from 'react-router-dom'
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
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  segreteria: 'Segreteria',
  economo: 'Economo',
  lettura: 'Sola lettura',
}

const baseNavItems = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/battesimi', label: 'Battesimi', icon: Droplets },
  { to: '/cresime', label: 'Cresime', icon: Star },
  { to: '/matrimoni', label: 'Matrimoni', icon: Heart },
  { to: '/importa', label: 'Importa Dati', icon: Upload },
  { to: '/rubrica', label: 'Rubrica', icon: BookOpen },
  { to: '/contabilita', label: 'Contabilità', icon: Wallet },
  { to: '/scanner', label: 'Scanner Docs', icon: ScanLine },
  { to: '/scadenziario', label: 'Scadenziario', icon: CalendarDays },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings },
]

export default function Layout() {
  const { user, logout } = useAuth()

  const navItems = [
    ...baseNavItems,
    // Utenti tab only visible to admin
    ...(user?.ruolo === 'admin'
      ? [{ to: '/utenti', label: 'Utenti', icon: Users, end: false }]
      : []),
  ]

  const initials = user
    ? `${user.nome.charAt(0)}${user.cognome.charAt(0)}`.toUpperCase()
    : '?'

  const roleLabel = user ? (ROLE_LABELS[user.ruolo] ?? user.ruolo) : ''

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-indigo-900 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-indigo-800">
          <Church className="text-indigo-300" size={28} />
          <span className="text-white font-bold text-xl tracking-tight">ReChurch</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
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
              {/* Avatar circle */}
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

          <p className="text-indigo-500 text-xs px-1">ReChurch v2.0</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
