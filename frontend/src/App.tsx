import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BattesimiList from './pages/battesimi/BattesimiList'
import BattesimoForm from './pages/battesimi/BattesimoForm'
import CresimeList from './pages/cresime/CresimeList'
import CresimaForm from './pages/cresime/CresimaForm'
import MatrimoniList from './pages/matrimoni/MatrimoniList'
import MatrimonioForm from './pages/matrimoni/MatrimonioForm'
import ImportaDati from './pages/ImportaDati'
import Impostazioni from './pages/Impostazioni'
import Utenti from './pages/Utenti'
import RubricaList from './pages/rubrica/RubricaList'
import PersonaForm from './pages/rubrica/PersonaForm'
import PersonaDetail from './pages/rubrica/PersonaDetail'
import FamigliaDetail from './pages/rubrica/FamigliaDetail'
import ContabilitaList from './pages/contabilita/ContabilitaList'
import MovimentoForm from './pages/contabilita/MovimentoForm'
import ScadenziarioPage from './pages/scadenziario/ScadenziarioPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes — Layout uses <Outlet /> to render children */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="battesimi" element={<BattesimiList />} />
          <Route path="battesimi/nuovo" element={<BattesimoForm />} />
          <Route path="battesimi/:id/modifica" element={<BattesimoForm />} />
          <Route path="cresime" element={<CresimeList />} />
          <Route path="cresime/nuovo" element={<CresimaForm />} />
          <Route path="cresime/:id/modifica" element={<CresimaForm />} />
          <Route path="matrimoni" element={<MatrimoniList />} />
          <Route path="matrimoni/nuovo" element={<MatrimonioForm />} />
          <Route path="matrimoni/:id/modifica" element={<MatrimonioForm />} />
          <Route path="importa" element={<ImportaDati />} />
          <Route path="rubrica" element={<RubricaList />} />
          <Route path="rubrica/persone/nuova" element={<PersonaForm />} />
          <Route path="rubrica/persone/:id" element={<PersonaDetail />} />
          <Route path="rubrica/persone/:id/modifica" element={<PersonaForm />} />
          <Route path="rubrica/famiglie/:id" element={<FamigliaDetail />} />
          <Route path="contabilita" element={<ContabilitaList />} />
          <Route path="contabilita/nuovo" element={<MovimentoForm />} />
          <Route path="contabilita/:id/modifica" element={<MovimentoForm />} />
          <Route path="scadenziario" element={<ScadenziarioPage />} />
          <Route path="impostazioni" element={<Impostazioni />} />
          <Route
            path="utenti"
            element={
              <ProtectedRoute roles={['admin']}>
                <Utenti />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
