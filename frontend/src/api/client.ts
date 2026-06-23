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
  luogo_battesimo?: string
  padre_nome?: string
  madre_nome?: string
  padrino_nome?: string
  madrina_nome?: string
  ministro?: string
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
  luogo_cresima?: string
  padre_nome?: string
  madre_nome?: string
  padrino_nome?: string
  madrina_nome?: string
  ministro?: string
  vescovo?: string
  numero_registro?: string
  anno_registro?: number
  note?: string
  created_at?: string
  updated_at?: string
}

export interface Comunione {
  id: number
  nome: string
  cognome: string
  data_nascita?: string
  luogo_nascita?: string
  data_comunione: string
  luogo_comunione?: string
  padre_nome?: string
  madre_nome?: string
  ministro?: string
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
  sposo_luogo_nascita?: string
  sposo_data_nascita?: string
  sposa_nome: string
  sposa_cognome: string
  sposa_luogo_nascita?: string
  sposa_data_nascita?: string
  data_matrimonio: string
  luogo_matrimonio?: string
  testimone1_nome?: string
  testimone2_nome?: string
  testimone3_nome?: string
  testimone4_nome?: string
  ministro?: string
  numero_registro?: string
  anno_registro?: number
  note?: string
  created_at?: string
  updated_at?: string
}

export interface StatsPeriod {
  periodo: string
  battesimi: number
  comunioni: number
  cresime: number
  matrimoni: number
}

export interface Stats {
  battesimi: number
  comunioni: number
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

export const comunioniApi = {
  list: (params?: { search?: string; anno?: number; skip?: number; limit?: number }) =>
    api.get<Comunione[]>('/comunioni/', { params }).then(r => r.data),
  get: (id: number) => api.get<Comunione>(`/comunioni/${id}`).then(r => r.data),
  create: (data: Omit<Comunione, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<Comunione>('/comunioni/', data).then(r => r.data),
  update: (id: number, data: Partial<Comunione>) =>
    api.put<Comunione>(`/comunioni/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/comunioni/${id}`),
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

export interface Anniversario {
  id: number
  sposo_nome: string
  sposo_cognome: string
  sposa_nome: string
  sposa_cognome: string
  data_matrimonio: string
  luogo_matrimonio?: string
  anniversario_anni: number
  mese_giorno: string
}

export interface AnniversariResponse {
  riferimento: string
  totale: number
  items: Anniversario[]
}

export const statsApi = {
  get: (params?: { dal?: string; al?: string }) =>
    api.get<Stats>('/stats/', { params }).then(r => r.data),
  anniversariMatrimoni: (params?: { periodo?: 'oggi' | 'settimana' | 'mese'; riferimento?: string }) =>
    api.get<AnniversariResponse>('/stats/anniversari/matrimoni', { params }).then(r => r.data),
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

export interface ReportTemplate {
  tipo: string
  titolo?: string
  intro?: string
  body?: string
  chiusura?: string
  firma_label?: string
  updated_at?: string
}

export interface Placeholder {
  key: string
  label: string
}

export interface BackupInfo {
  path: string
  size_bytes: number
  size_human: string
  modified?: string
  counts: {
    battesimi: number
    comunioni: number
    cresime: number
    matrimoni: number
  }
}

export const backupApi = {
  info: () => api.get<BackupInfo>('/backup/info').then(r => r.data),
  downloadUrl: () => '/api/backup/download',
  exportCsvUrl: (tipo: string) => `/api/backup/export/csv/${tipo}`,
  exportZipUrl: () => '/api/backup/export/zip',
  restore: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<{ ok: boolean; message: string }>('/backup/restore', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

export const reportTemplatesApi = {
  list: () => api.get<ReportTemplate[]>('/report-templates/').then(r => r.data),
  get: (tipo: string) => api.get<ReportTemplate>(`/report-templates/${tipo}`).then(r => r.data),
  update: (tipo: string, data: Partial<ReportTemplate>) =>
    api.put<ReportTemplate>(`/report-templates/${tipo}`, data).then(r => r.data),
  reset: (tipo: string) =>
    api.post<ReportTemplate>(`/report-templates/${tipo}/reset`).then(r => r.data),
  placeholders: (tipo: string) =>
    api.get<{ tipo: string; placeholders: Placeholder[] }>(`/report-templates/${tipo}/placeholders`).then(r => r.data),
  previewUrl: (tipo: string) => `/api/pdf/preview/${tipo}?inline=1`,
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

export interface AnimaListItem {
  id: string
  nome: string
  cognome: string
  data_nascita?: string
  luogo_nascita?: string
  battesimi_count: number
  comunioni_count: number
  cresime_count: number
  matrimoni_count: number
  total_sacramenti: number
}

export interface AnimaDettaglio {
  id: string
  nome: string
  cognome: string
  data_nascita?: string
  luogo_nascita?: string
  battesimi: Battesimo[]
  comunioni: Comunione[]
  cresime: Cresima[]
  matrimoni: Matrimonio[]
}

export const animeApi = {
  list: (params?: {
    search?: string
    has_battesimo?: boolean
    has_comunione?: boolean
    has_cresima?: boolean
    has_matrimonio?: boolean
    skip?: number
    limit?: number
  }) =>
    api.get<{ total: number; items: AnimaListItem[] }>('/anime/', { params }).then(r => r.data),
  get: (id: string) => api.get<AnimaDettaglio>(`/anime/${id}`).then(r => r.data),
}

export const pdfApi = {
  // Download (Content-Disposition: attachment)
  battesimoUrl:    (id: number) => `/api/pdf/battesimo/${id}`,
  comunioneUrl:    (id: number) => `/api/pdf/comunione/${id}`,
  cresimaUrl:      (id: number) => `/api/pdf/cresima/${id}`,
  matrimonioUrl:   (id: number) => `/api/pdf/matrimonio/${id}`,
  // Inline view (apre nel browser)
  battesimoView:   (id: number) => `/api/pdf/battesimo/${id}?inline=1`,
  comunioneView:   (id: number) => `/api/pdf/comunione/${id}?inline=1`,
  cresimaView:     (id: number) => `/api/pdf/cresima/${id}?inline=1`,
  matrimonioView:  (id: number) => `/api/pdf/matrimonio/${id}?inline=1`,
  // Stampa elenco (lista filtrata)
  elencoView: (tipo: 'battesimi' | 'comunioni' | 'cresime' | 'matrimoni', params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams({ inline: '1' })
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.append(k, String(v)) })
    return `/api/pdf/elenco/${tipo}?${q.toString()}`
  },
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
  templateUrl: (tipo: string) => `/api/import/template/${tipo}`,
  getFields: (tipo: string) =>
    api.get<{
      tipo: string
      fields: { name: string; required: boolean }[]
      sample: Record<string, string>
    }>(`/import/fields/${tipo}`).then(r => r.data),
}

export default api
