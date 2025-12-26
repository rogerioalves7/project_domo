# 📋 Backlog do Projeto Domo

## 🔵 Prioridade 2: Implementação Offline-First (Abordagem Gradual)
- [ ] **Infraestrutura:** Reinstalar `@tanstack/react-query` e configurar `QueryClientProvider` no `main.jsx`.
- [ ] **Refatoração (Leitura):** Substituir `useEffect` por `useQuery` no `Shopping.jsx` (apenas para carregar dados).
- [ ] **Refatoração (Escrita):** Implementar `useMutation` para adicionar/remover itens.
- [ ] **Modo Offline:** Ativar `networkMode: 'offlineFirst'` e UI Otimista apenas após validação das etapas anteriores.

## 🟢 Melhorias Futuras (Backlog)
- [ ] **UI Sync:** Indicador visual de estado de sincronização (Ícone de Nuvem/Local na barra lateral).