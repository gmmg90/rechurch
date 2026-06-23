import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: attach JWT token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rechurch_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: on 401 clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login')
    ) {
      localStorage.removeItem('rechurch_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface Battesimo {
  id: number
  nome: string
  cognome: string
  data_nascita?: string
  luogo_nascita?: string
  data_battesimo: string
  luogo_battesimo: string
  padre_nome?: string
  madre_nome?: string
  padrino_nome?: string
  madrina_nome?: string
  ministro: string
  numero_registro?: string
  anno_registro?: number
  note?: string
  created_at?: string
  updated_at?: string
}

export interface Cresima {
  id: number
  nome: string
  cognome: string
  data_nascita?: string
  luogo_nascita?: string
  data_cresima: string
  luogo_cresima: string
  padre_nome?: string
  madre_nome?: string
  padrino_nome?: string
  madrina_nome?: string
  ministro: string
  vescovo?: string
  numero_registro?: string
  anno_registro?: number
  note?: string
  created_at?: string
  updated_at?: string
}

export interface Matrimonio {
  id: number
  sposo_nome: string
  sposo_cognome: string
  sposa_nome: string
  sposa_cognome: string
  data_matrimonio: string
  luogo_matrimonio: string
  testimone1_nome?: string
  testimone2_nome?: string
  ministro: string
  numero_registro?: string
  anno_registro?: number
  note?: string
  created_at?: string
  updated_at?: string
}

export interface StatsPeriod {
  periodo: string
  battesimi: number
  cresime: number
  matrimoni: number
}

export interface Stats {
  battesimi: number
  cresime: number
  matrimoni: number
  per_anno: StatsPeriod[]
  per_mese: StatsPeriod[]
  per_decennio: StatsPeriod[]
}

export const battesimiApi = {
  list: (params?: { search?: string; anno?: number; skip?: number; limit?: number }) =>
    api.get<Battesimo[]>('/battesimi/', { params }).then(r => r.data),
  get: (id: number) => api.get<Battesimo>(`/battesimi/${id}`).then(r => r.data),
  create: (data: Omit<Battesimo, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Battesimo>('/battesimi/', data).then(r => r.data),
  update: (id: number, data: Partial<Battesimo>) =>
    api.put<Battesimo>(`/battesimi/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/battesimi/${id}`),
}

export const cresimeApi = {
  list: (params?: { search?: string; anno?: number; skip?: number; limit?: number }) =>
    api.get<Cresima[]>('/cresime/', { params }).then(r => r.data),
  get: (id: number) => api.get<Cresima>(`/cresime/${id}`).then(r => r.data),
  create: (data: Omit<Cresima, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Cresima>('/cresime/', data).then(r => r.data),
  update: (id: number, data: Partial<Cresima>) =>
    api.put<Cresima>(`/cresime/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/cresime/${id}`),
}

export const matrimoniApi = {
  list: (params?: { search?: string; anno?: number; skip?: number; limit?: number }) =>
    api.get<Matrimonio[]>('/matrimoni/', { params }).then(r => r.data),
  get: (id: number) => api.get<Matrimonio>(`/matrimoni/${id}`).then(r => r.data),
  create: (data: Omit<Matrimonio, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Matrimonio>('/matrimoni/', data).then(r => r.data),
  update: (id: number, data: Partial<Matrimonio>) =>
    api.put<Matrimonio>(`/matrimoni/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/matrimoni/${id}`),
}

export const statsApi = {
  get: (params?: { dal?: string; al?: string }) =>
    api.get<Stats>('/stats/', { params }).then(r => r.data),
}

export interface ParrocchiaConfig {
  id: number
  nome: string
  diocesi?: string
  indirizzo?: string
  cap?: string
  citta?: string
  provincia?: string
  telefono?: string
  email?: string
  parroco?: string
  logo_path?: string
  updated_at?: string
}

export const configApi = {
  get: () => api.get<ParrocchiaConfig>('/config/').then(r => r.data),
  update: (data: Partial<Omit<ParrocchiaConfig, 'id' | 'logo_path' | 'updated_at'>>) =>
    api.put<ParrocchiaConfig>('/config/', data).then(r => r.data),
  uploadLogo: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ logo_url: string }>('/config/logo', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  deleteLogo: () => api.delete('/config/logo'),
}

export const pdfApi = {
  battesimoUrl: (id: number) => `/api/pdf/battesimo/${id}`,
  cresimaUrl:   (id: number) => `/api/pdf/cresima/${id}`,
  matrimonioUrl:(id: number) => `/api/pdf/matrimonio/${id}`,
}

export const importApi = {
  previewCsv: (tipo: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ columns: string[]; preview: Record<string, string>[]; total_rows: number }>(
      `/import/csv/${tipo}/preview`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
  importCsv: (tipo: string, file: File, mapping: Record<string, string>) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mapping', JSON.stringify(mapping))
    return api.post<{ inserted: number; errors: string[]; total_rows: number }>(
      `/import/csv/${tipo}`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },
  uploadMdb: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{
      session_id: string
      tables: { name: string; columns: string[]; sample: string[][] }[]
    }>('/import/mdb', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  confirmMdb: (payload: {
    session_id: string
    mappings: { table: string; tipo: string; column_mapping: Record<string, string> }[]
  }) =>
    api.post<{ inserted: number; errors: string[] }>('/import/mdb/confirm', payload).then(r => r.data),
}

export interface AuthUser {
  id: number
  nome: string
  cognome: string
  email: string
  ruolo: string
  attivo: boolean
  ultimo_accesso?: string
  created_at?: string
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; token_type: string; user: AuthUser }>(
      '/auth/login',
      { email, password }
    ).then(r => r.data),
  me: () => api.get<AuthUser>('/auth/me').then(r => r.data),
  cambiaPassword: (password_attuale: string, nuova_password: string) =>
    api.put('/auth/cambia-password', { password_attuale, nuova_password }).then(r => r.data),
  listUtenti: () => api.get<AuthUser[]>('/auth/utenti').then(r => r.data),
  createUtente: (data: {
    nome: string; cognome: string; email: string; ruolo: string; password: string
  }) => api.post<AuthUser>('/auth/utenti', data).then(r => r.data),
  updateUtente: (id: number, data: Partial<{
    nome: string; cognome: string; email: string; ruolo: string; attivo: boolean
  }>) => api.put<AuthUser>(`/auth/utenti/${id}`, data).then(r => r.data),
  deleteUtente: (id: number) => api.delete(`/auth/utenti/${id}`).then(r => r.data),
}

export const backupApi = {
  esegui: () => api.post<{ filename: string; size_kb: number }>('/backup/esegui').then(r => r.data),
  lista: () => api.get<{ filename: string; size_kb: number; created_at: string }[]>('/backup/lista').then(r => r.data),
  downloadUrl: (filename: string) => `/api/backup/${filename}`,
}

export interface Famiglia {
  id: number
  cognome: string
  indirizzo?: string
  cap?: string
  citta?: string
  telefono?: string
  note?: string
  num_persone?: number
  created_at?: string
  updated_at?: string
}

export interface Persona {
  id: number
  nome: string
  cognome: string
  sesso?: string
  data_nascita?: string
  luogo_nascita?: string
  indirizzo?: string
  cap?: string
  citta?: string
  telefono?: string
  email?: string
  famiglia_id?: number
  famiglia_cognome?: string
  note?: string
  created_at?: string
  updated_at?: string
  // from PersonaDetail
  battesimo?: Battesimo
  cresima?: Cresima
  matrimonio?: Matrimonio
  ruolo_matrimonio?: string
}

export const rubricaApi = {
  listPersone: (params?: { search?: string; famiglia_id?: number; skip?: number; limit?: number }) =>
    api.get<Persona[]>('/rubrica/persone/', { params }).then(r => r.data),
  getPersona: (id: number) => api.get<Persona>(`/rubrica/persone/${id}`).then(r => r.data),
  createPersona: (data: Omit<Persona, 'id' | 'created_at' | 'updated_at' | 'famiglia_cognome' | 'battesimo' | 'cresima' | 'matrimonio' | 'ruolo_matrimonio'>) =>
    api.post<Persona>('/rubrica/persone/', data).then(r => r.data),
  updatePersona: (id: number, data: Partial<Omit<Persona, 'famiglia_id'>> & { famiglia_id?: number | null }) =>
    api.put<Persona>(`/rubrica/persone/${id}`, data).then(r => r.data),
  deletePersona: (id: number) => api.delete(`/rubrica/persone/${id}`),
  linkSacramento: (personaId: number, tipo: string, sacramento_id: number, ruolo?: string) =>
    api.post(`/rubrica/persone/${personaId}/sacramento`, { tipo, sacramento_id, ruolo }).then(r => r.data),
  unlinkSacramento: (personaId: number, tipo: string) =>
    api.delete(`/rubrica/persone/${personaId}/sacramento/${tipo}`).then(r => r.data),

  listFamiglie: (params?: { search?: string; skip?: number; limit?: number }) =>
    api.get<Famiglia[]>('/rubrica/famiglie/', { params }).then(r => r.data),
  getFamiglia: (id: number) => api.get<Famiglia & { persone: Persona[] }>(`/rubrica/famiglie/${id}`).then(r => r.data),
  createFamiglia: (data: Omit<Famiglia, 'id' | 'created_at' | 'updated_at' | 'num_persone'>) =>
    api.post<Famiglia>('/rubrica/famiglie/', data).then(r => r.data),
  updateFamiglia: (id: number, data: Partial<Famiglia>) =>
    api.put<Famiglia>(`/rubrica/famiglie/${id}`, data).then(r => r.data),
  deleteFamiglia: (id: number) => api.delete(`/rubrica/famiglie/${id}`),
}

export interface CategoriaContabile {
  id: number
  nome: string
  tipo: 'entrata' | 'uscita'
  colore?: string
  note?: string
  created_at?: string
}

export interface Fornitore {
  id: number
  nome: string
  partita_iva?: string
  indirizzo?: string
  telefono?: string
  email?: string
  note?: string
  created_at?: string
}

export interface MovimentoContabile {
  id: number
  data: string
  tipo: 'entrata' | 'uscita'
  importo: number
  descrizione: string
  categoria_id?: number
  categoria_nome?: string
  fornitore_id?: number
  fornitore_nome?: string
  numero_documento?: string
  metodo_pagamento?: string
  note?: string
  created_at?: string
  updated_at?: string
}

export interface RiepilogoContabile {
  totale_entrate: number
  totale_uscite: number
  saldo: number
  per_categoria: { categoria_id: number | null; categoria: string; tipo: string; colore: string; totale: number }[]
}

export const contabilitaApi = {
  listCategorie: (tipo?: string) =>
    api.get<CategoriaContabile[]>('/contabilita/categorie/', { params: tipo ? { tipo } : {} }).then(r => r.data),
  createCategoria: (data: Omit<CategoriaContabile, 'id' | 'created_at'>) =>
    api.post<CategoriaContabile>('/contabilita/categorie/', data).then(r => r.data),
  updateCategoria: (id: number, data: Partial<CategoriaContabile>) =>
    api.put<CategoriaContabile>(`/contabilita/categorie/${id}`, data).then(r => r.data),
  deleteCategoria: (id: number) => api.delete(`/contabilita/categorie/${id}`),

  listFornitori: (search?: string) =>
    api.get<Fornitore[]>('/contabilita/fornitori/', { params: search ? { search } : {} }).then(r => r.data),
  createFornitore: (data: Omit<Fornitore, 'id' | 'created_at'>) =>
    api.post<Fornitore>('/contabilita/fornitori/', data).then(r => r.data),
  updateFornitore: (id: number, data: Partial<Fornitore>) =>
    api.put<Fornitore>(`/contabilita/fornitori/${id}`, data).then(r => r.data),
  deleteFornitore: (id: number) => api.delete(`/contabilita/fornitori/${id}`),

  listMovimenti: (params?: {
    search?: string; tipo?: string; categoria_id?: number; fornitore_id?: number;
    dal?: string; al?: string; skip?: number; limit?: number
  }) =>
    api.get<MovimentoContabile[]>('/contabilita/movimenti/', { params }).then(r => r.data),
  getMovimento: (id: number) => api.get<MovimentoContabile>(`/contabilita/movimenti/${id}`).then(r => r.data),
  createMovimento: (data: Omit<MovimentoContabile, 'id' | 'created_at' | 'updated_at' | 'categoria_nome' | 'fornitore_nome'>) =>
    api.post<MovimentoContabile>('/contabilita/movimenti/', data).then(r => r.data),
  updateMovimento: (id: number, data: Partial<MovimentoContabile>) =>
    api.put<MovimentoContabile>(`/contabilita/movimenti/${id}`, data).then(r => r.data),
  deleteMovimento: (id: number) => api.delete(`/contabilita/movimenti/${id}`),

  riepilogo: (params?: { dal?: string; al?: string }) =>
    api.get<RiepilogoContabile>('/contabilita/riepilogo/', { params }).then(r => r.data),

  exportExcelUrl: (dal?: string, al?: string) => {
    const p = new URLSearchParams()
    if (dal) p.set('dal', dal)
    if (al) p.set('al', al)
    return `/api/contabilita/export/excel${p.toString() ? '?' + p.toString() : ''}`
  },
}

export interface CategoriaEvento {
  id: number
  nome: string
  colore: string
}

export interface Evento {
  id: number
  titolo: string
  descrizione?: string
  data_inizio: string  // ISO datetime
  data_fine?: string
  tutto_il_giorno: boolean
  luogo?: string
  categoria_id?: number
  categoria_nome?: string
  categoria_colore?: string
  ricorrenza?: string
  ricorrenza_fine?: string
  occurrence_start?: string
  occurrence_end?: string
  note?: string
  created_at?: string
  updated_at?: string
}

export const scadenziarioApi = {
  listCategorie: () => api.get<CategoriaEvento[]>('/scadenziario/categorie/').then(r => r.data),
  createCategoria: (data: Omit<CategoriaEvento, 'id'>) =>
    api.post<CategoriaEvento>('/scadenziario/categorie/', data).then(r => r.data),
  updateCategoria: (id: number, data: Partial<CategoriaEvento>) =>
    api.put<CategoriaEvento>(`/scadenziario/categorie/${id}`, data).then(r => r.data),
  deleteCategoria: (id: number) => api.delete(`/scadenziario/categorie/${id}`),

  listEventi: (params?: { dal?: string; al?: string; categoria_id?: number }) =>
    api.get<Evento[]>('/scadenziario/eventi/', { params }).then(r => r.data),
  getEvento: (id: number) => api.get<Evento>(`/scadenziario/eventi/${id}`).then(r => r.data),
  createEvento: (data: Omit<Evento, 'id' | 'created_at' | 'updated_at' | 'categoria_nome' | 'categoria_colore' | 'occurrence_start' | 'occurrence_end'>) =>
    api.post<Evento>('/scadenziario/eventi/', data).then(r => r.data),
  updateEvento: (id: number, data: Partial<Evento>) =>
    api.put<Evento>(`/scadenziario/eventi/${id}`, data).then(r => r.data),
  deleteEvento: (id: number) => api.delete(`/scadenziario/eventi/${id}`),
  prossimiEventi: (giorni?: number) =>
    api.get<Evento[]>('/scadenziario/prossimi/', { params: giorni ? { giorni } : {} }).then(r => r.data),
}

export default api
