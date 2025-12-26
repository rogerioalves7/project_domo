# 📋 Backlog do Projeto Domo

## 🔴 Prioridade 0: Correções Críticas (Deploy & Produção)
- [X] **Fix Backend Signal:** Corrigir `NameError: name 'settings' is not defined` no ficheiro `backend/core/signals.py` (Adicionar `from django.conf import settings` no topo).
- [ ] ***Fix E-mail Sending:*** Corrigir o problema de envio do e-mail em produção.
- [ ] **Fix Environment Variable:** Investigar por que `FRONTEND_URL` não está a ser lido corretamente no Render (Link do convite a sair como `localhost`).
- [ ] **Validate SMTP:** Confirmar se a Senha de Aplicação do Gmail está a autenticar corretamente no ambiente de produção.

## 🟡 Prioridade 1: Validação de Estabilidade (Pós-Reversão)
- [ ] **Bug Crítico: Cartão de Crédito (Retroativo):**
    - Lançamentos de despesas em cartão com data passada não aparecem no **Histórico Recente**.
    - **Regra de Negócio (Estratégica):** Para compras parceladas retroativas, o sistema deve identificar as parcelas que já venceram no passado. Estas devem ser consideradas "pagas" e **não devem deduzir do limite disponível** atual, restando debitar do limite apenas as parcelas futuras.
- [ ] **Teste Monetário:** Criar conta com cêntimos (ex: `R$ 1.250,99`) e editar para valor redondo (ex: `R$ 2.000,00`) para validar correção do bug da vírgula.
- [ ] **Teste de Stock:** Validar ciclo de vida (Stock Mínimo vs Atual) na Lista de Compras (garantir lógica estrita `<`).

## 🔵 Prioridade 2: Implementação Offline-First (Abordagem Gradual)
- [ ] **Infraestrutura:** Reinstalar `@tanstack/react-query` e configurar `QueryClientProvider` no `main.jsx`.
- [ ] **Refatoração (Leitura):** Substituir `useEffect` por `useQuery` no `Shopping.jsx` (apenas para carregar dados).
- [ ] **Refatoração (Escrita):** Implementar `useMutation` para adicionar/remover itens.
- [ ] **Modo Offline:** Ativar `networkMode: 'offlineFirst'` e UI Otimista apenas após validação das etapas anteriores.

## 🟢 Melhorias Futuras (Backlog)
- [ ] **Privacidade:** Implementar "Olho Mágico" (***) no topo da aplicação para ocultar valores sensíveis.
- [ ] **UI Sync:** Indicador visual de estado de sincronização (Ícone de Nuvem/Local na barra lateral).