import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BattesimiList from './pages/battesimi/BattesimiList'
import BattesimoForm from './pages/battesimi/BattesimoForm'
import CresimeList from './pages/cresime/CresimeList'
import CresimaForm from './pages/cresime/CresimaForm'
import MatrimoniList from './pages/matrimoni/MatrimoniList'
import MatrimonioForm from './pages/matrimoni/MatrimonioForm'
import ImportaDati from './pages/ImportaDati'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/battesimi" element={<BattesimiList />} />
        <Route path="/battesimi/nuovo" element={<BattesimoForm />} />
        <Route path="/battesimi/:id/modifica" element={<BattesimoForm />} />
        <Route path="/cresime" element={<CresimeList />} />
        <Route path="/cresime/nuovo" element={<CresimaForm />} />
        <Route path="/cresime/:id/modifica" element={<CresimaForm />} />
        <Route path="/matrimoni" element={<MatrimoniList />} />
        <Route path="/matrimoni/nuovo" element={<MatrimonioForm />} />
        <Route path="/matrimoni/:id/modifica" element={<MatrimonioForm />} />
        <Route path="/importa" element={<ImportaDati />} />
      </Route>
    </Routes>
  )
}
