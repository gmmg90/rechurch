import { createContext, useContext, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { configApi } from '../api/client'

interface ModuloInfo {
  codice: string
  nome: string
  descrizione?: string
  icona?: string
  attivo: boolean
  ordine: number
}

interface ModuliContextType {
  moduli: Record<string, boolean>
  moduliList: ModuloInfo[]
  isLoading: boolean
  toggle: (codice: string, attivo: boolean) => Promise<void>
}

const ModuliContext = createContext<ModuliContextType>({
  moduli: {},
  moduliList: [],
  isLoading: false,
  toggle: async () => {},
})

export function ModuliProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['moduli'],
    queryFn: () => configApi.getModuli(),
    staleTime: 60_000,
  })

  const moduli = useMemo(
    () => Object.fromEntries(list.map(m => [m.codice, m.attivo])),
    [list]
  )

  const toggle = async (codice: string, attivo: boolean) => {
    await configApi.updateModulo(codice, attivo)
    qc.invalidateQueries({ queryKey: ['moduli'] })
  }

  return (
    <ModuliContext.Provider value={{ moduli, moduliList: list, isLoading, toggle }}>
      {children}
    </ModuliContext.Provider>
  )
}

export function useModuli() {
  return useContext(ModuliContext)
}
