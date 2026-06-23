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
import Impostazioni from './pages/Impostazioni'
import ModelliCertificati from './pages/ModelliCertificati'
import BackupEsportazioni from './pages/BackupEsportazioni'
import CertificatoView from './pages/CertificatoView'
import AnimeList from './pages/anime/AnimeList'
import AnimaDettaglio from './pages/anime/AnimaDettaglio'
import ComunioniList from './pages/comunioni/ComunioniList'
import ComunioneForm from './pages/comunioni/ComunioneForm'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/anime" element={<AnimeList />} />
        <Route path="/anime/:id" element={<AnimaDettaglio />} />
        <Route path="/battesimi" element={<BattesimiList />} />
        <Route path="/battesimi/nuovo" element={<BattesimoForm />} />
        <Route path="/battesimi/:id/modifica" element={<BattesimoForm />} />
        <Route path="/battesimi/:id/certificato" element={<CertificatoView tipo="battesimi" />} />
        <Route path="/comunioni" element={<ComunioniList />} />
        <Route path="/comunioni/nuovo" element={<ComunioneForm />} />
        <Route path="/comunioni/:id/modifica" element={<ComunioneForm />} />
        <Route path="/comunioni/:id/certificato" element={<CertificatoView tipo="comunioni" />} />
        <Route path="/cresime" element={<CresimeList />} />
        <Route path="/cresime/nuovo" element={<CresimaForm />} />
        <Route path="/cresime/:id/modifica" element={<CresimaForm />} />
        <Route path="/cresime/:id/certificato" element={<CertificatoView tipo="cresime" />} />
        <Route path="/matrimoni" element={<MatrimoniList />} />
        <Route path="/matrimoni/nuovo" element={<MatrimonioForm />} />
        <Route path="/matrimoni/:id/modifica" element={<MatrimonioForm />} />
        <Route path="/matrimoni/:id/certificato" element={<CertificatoView tipo="matrimoni" />} />
        <Route path="/importa" element={<ImportaDati />} />
        <Route path="/impostazioni" element={<Impostazioni />} />
        <Route path="/impostazioni/modelli" element={<ModelliCertificati />} />
        <Route path="/impostazioni/backup" element={<BackupEsportazioni />} />
      </Route>
    </Routes>
  )
}
