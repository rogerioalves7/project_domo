import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 1. Importações do React Query (Core)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 2. Importação do Contexto de Privacidade
// (Verifique se sua pasta é 'context' ou 'contexts' conforme sua estrutura)
import { PrivacyProvider } from './context/PrivacyContext'; 

// 3. Configuração do "Cérebro" (Cache)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // LEITURA (GET):
      // 'offlineFirst' permite que o app leia dados do cache mesmo sem internet.
      // Se não tiver cache, ele tenta buscar e falha (ou mostra loading).
      networkMode: 'offlineFirst',
      
      // Os dados ficam "frescos" por 5 minutos (não refaz request à toa ao trocar de tela)
      staleTime: 1000 * 60 * 5, 
      
      // Os dados inativos ficam na memória por 24h antes de serem limpos
      gcTime: 1000 * 60 * 60 * 24, 
      
      retry: 1, // Tenta mais 1 vez se der erro de rede na leitura
      refetchOnWindowFocus: false, // Não recarrega ao trocar de aba (bom para dev)
    },
    mutations: {
      // ESCRITA (POST/PUT/DELETE):
      // AQUI ESTÁ O SEGREDO: Removemos o 'networkMode: offlineFirst'.
      // O padrão é 'online', o que faz o React Query PAUSAR a mutação se 
      // o navegador estiver offline. Ele só tenta enviar quando a internet voltar.
      // Isso evita que ele tente, falhe e faça rollback imediato.
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* O Provider do React Query deve ficar no topo para envolver tudo */}
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
          <App />
      </PrivacyProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);