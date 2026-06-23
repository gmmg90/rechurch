import { NavLink, Outlet } from 'react-router-dom'
import { Church, Home, Droplets, Cookie, Star, Heart, Upload, Settings, Users } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/anime', label: 'Anime', icon: Users },
  { to: '/battesimi', label: 'Battesimi', icon: Droplets },
  { to: '/comunioni', label: 'Comunioni', icon: Cookie },
  { to: '/cresime', label: 'Cresime', icon: Star },
  { to: '/matrimoni', label: 'Matrimoni', icon: Heart },
  { to: '/importa', label: 'Importa Dati', icon: Upload },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="no-print w-64 bg-indigo-900 flex flex-col">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-indigo-800">
          <Church className="text-indigo-300" size={28} />
          <span className="text-white font-bold text-xl tracking-tight">ReChurch</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-700 text-white'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-indigo-800">
          <p className="text-indigo-400 text-xs">ReChurch v1.0</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
