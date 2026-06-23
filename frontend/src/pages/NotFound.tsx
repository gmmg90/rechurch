import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <p className="text-7xl font-bold text-indigo-200">404</p>
      <h1 className="text-2xl font-bold text-gray-700">Pagina non trovata</h1>
      <p className="text-gray-400 text-sm">L'indirizzo che hai cercato non esiste.</p>
      <Link
        to="/"
        className="flex items-center gap-2 mt-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        <Home size={16} /> Torna alla Dashboard
      </Link>
    </div>
  )
}
