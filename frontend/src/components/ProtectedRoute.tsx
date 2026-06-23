import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Caricamento...</p>
      </div>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-indigo-300 mb-4">403</p>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Accesso negato</h1>
        <p className="text-gray-500">Non hai i permessi necessari per visualizzare questa pagina.</p>
      </div>
    </div>
  )
}

interface ProtectedRouteProps {
  children: ReactNode
  roles?: string[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.ruolo)) return <AccessDenied />

  return <>{children}</>
}
