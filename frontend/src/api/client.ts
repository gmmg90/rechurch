import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

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

export interface Stats {
  battesimi: number
  cresime: number
  matrimoni: number
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
  get: () => api.get<Stats>('/stats/').then(r => r.data),
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

export default api
