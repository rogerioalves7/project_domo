import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- 1. IMPORTAÇÕES DO MODO OFFLINE ---
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

// --- 2. CONFIGURAÇÃO DO CACHE ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // IMPORTANTE: 'offlineFirst' garante que o React Query tente ler o cache 
      // ou executar a query mesmo sem internet, em vez de ficar "pausado".
      networkMode: 'offlineFirst',
      
      // Tempo que o dado é considerado "fresco" (5 minutos)
      staleTime: 1000 * 60 * 5, 
      
      // Cache dura 24 horas (mesmo offline/fechando aba)
      // (Nota: Em versões antigas do Tanstack isso chamava cacheTime)
      gcTime: 1000 * 60 * 60 * 24, 
      
      retry: 1, 
    },
    mutations: {
      networkMode: 'offlineFirst',
    }
  },
})

// --- 3. CONFIGURAÇÃO DA PERSISTÊNCIA (Salvar no Navegador) ---
const persister = createSyncStoragePersister({
  storage: window.localStorage, // Salva no LocalStorage do usuário
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ 
        persister, 
        maxAge: 1000 * 60 * 60 * 24 // Garante que a persistência dure 24h
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)