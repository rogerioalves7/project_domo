import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import MobileMenu from '../components/MobileMenu';
import Modal from '../components/Modal';
import ProductManager from '../components/ProductManager';
import MoneyInput from '../components/MoneyInput';
import { 
  ShoppingCart, Check, Trash2, Plus, Minus, RefreshCw, CheckCircle, Wallet, CreditCard, WifiOff, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Shopping() {
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState('PRODUCT_SELECT'); 
  const [paymentMethod, setPaymentMethod] = useState('ACCOUNT');
  const [selectedSource, setSelectedSource] = useState('');

  // --- 1. LEITURA DE DADOS ---
  const { data: items = [], isLoading: loadingList, isRefetching } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: async () => (await api.get('/shopping-list/')).data,
    staleTime: 1000 * 60 * 5, 
  });

  const { data: products = [] } = useQuery({ 
    queryKey: ['products'], 
    queryFn: () => api.get('/products/').then(res => res.data),
    staleTime: 1000 * 60 * 60 
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => (await api.get('/accounts/')).data,
    staleTime: 1000 * 60 * 30,
  });

  const { data: cards = [] } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => (await api.get('/credit-cards/')).data,
    staleTime: 1000 * 60 * 30,
  });

  // --- 2. CÁLCULOS ---
  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
        const qty = parseFloat(item?.quantity_to_buy || 0);
        const estUnit = parseFloat(item?.estimated_price || 0);
        
        acc.estimated += estUnit * qty;

        if (item?.is_purchased) {
            const realUnit = parseFloat(item?.real_unit_price || 0);
            const discUnit = parseFloat(item?.discount_unit_price || 0);
            
            const finalReal = realUnit > 0 ? realUnit : estUnit;
            const finalDisc = discUnit > 0 ? discUnit : finalReal;
            
            acc.real += finalReal * qty;
            acc.discount += finalDisc * qty;
        }
        return acc;
    }, { estimated: 0, real: 0, discount: 0 });
  }, [items]);

  // --- 3. MUTAÇÕES ---

  // ADICIONAR ITEM (COM SYNC DE ESTADO)
  const addMutation = useMutation({
    mutationFn: (payload) => {
        // Remove ID temporário antes de enviar
        const { tempId, ...dataToSend } = payload;

        if (String(payload.product).startsWith('temp-')) {
             return api.post('/shopping-list/', { 
                 create_product_name: payload.product_name, 
                 quantity_to_buy: payload.quantity_to_buy 
             });
        }
        return api.post('/shopping-list/', dataToSend);
    },
    retry: 3,
    onMutate: async (newItemPayload) => {
        await queryClient.cancelQueries({ queryKey: ['shopping-list'] });
        const previousItems = queryClient.getQueryData(['shopping-list']);

        const productData = products.find(p => p.id == newItemPayload.product);
        const productName = productData ? productData.name : newItemPayload.product_name || "Item Novo";
        const estPrice = productData ? productData.estimated_price : 0;

        // Usa o tempId gerado no handler ou gera um novo
        const tempId = newItemPayload.tempId || 'temp-' + Math.random();

        const optimisticItem = {
            id: tempId,
            product: newItemPayload.product,
            product_name: productName,
            quantity_to_buy: newItemPayload.quantity_to_buy,
            estimated_price: estPrice,
            is_purchased: false,
            real_unit_price: 0,
            discount_unit_price: 0,
            is_offline: true
        };

        queryClient.setQueryData(['shopping-list'], old => [...(old || []), optimisticItem]);
        setIsModalOpen(false);
        toast.success("Adicionado à lista!");
        
        return { previousItems };
    },
    onError: (err, newItem, context) => {
        toast.error("Sem conexão. Salvo localmente.", { icon: <WifiOff size={18}/> });
    },
    // SUCESSO: AQUI É A MÁGICA DA SINCRONIZAÇÃO
    onSuccess: async (response, variables) => {
        const newItem = response.data; // O item "virgem" que veio do servidor
        const tempId = variables.tempId; // O ID temporário que estava na tela

        // Busca o estado ATUAL do item na tela (pode ter sido checkado offline)
        const currentList = queryClient.getQueryData(['shopping-list']);
        const localItem = currentList?.find(i => i.id === tempId);

        if (localItem) {
            // Verifica se o usuário mexeu no item enquanto estava offline
            const updates = {};
            if (localItem.is_purchased) updates.is_purchased = true;
            if (Number(localItem.real_unit_price) > 0) updates.real_unit_price = localItem.real_unit_price;
            if (Number(localItem.discount_unit_price) > 0) updates.discount_unit_price = localItem.discount_unit_price;
            if (Number(localItem.quantity_to_buy) !== Number(newItem.quantity_to_buy)) updates.quantity_to_buy = localItem.quantity_to_buy;

            // Se houve alterações offline, envia elas AGORA para o servidor
            if (Object.keys(updates).length > 0) {
                try {
                    await api.patch(`/shopping-list/${newItem.id}/`, updates);
                    // Atualiza o objeto newItem com as alterações para atualizar o cache corretamente
                    Object.assign(newItem, updates);
                } catch (e) {
                    console.error("Erro ao sincronizar edições offline", e);
                }
            }

            // Substitui o item temporário pelo item real (já atualizado) no cache
            queryClient.setQueryData(['shopping-list'], old => 
                old.map(i => i.id === tempId ? newItem : i)
            );
        }
        
        // Garante que tudo está limpo
        queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
    }
  });

  // ATUALIZAR ITEM
  const updateMutation = useMutation({
    mutationFn: ({ id, field, value }) => api.patch(`/shopping-list/${id}/`, { [field]: value }),
    retry: 3,
    onMutate: async ({ id, field, value }) => {
        if (String(id).startsWith('temp-')) return;
        await queryClient.cancelQueries({ queryKey: ['shopping-list'] });
        const previousItems = queryClient.getQueryData(['shopping-list']);
        queryClient.setQueryData(['shopping-list'], old => 
            old.map(item => item.id === id ? { ...item, [field]: value } : item)
        );
        return { previousItems };
    },
    onError: () => toast.error("Alteração pendente de conexão.", { icon: <WifiOff size={18}/> }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
  });

  // REMOVER ITEM
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/shopping-list/${id}/`),
    retry: 3,
    onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: ['shopping-list'] });
        const previousItems = queryClient.getQueryData(['shopping-list']);
        queryClient.setQueryData(['shopping-list'], old => old.filter(item => item.id !== id));
        return { previousItems };
    },
    onError: () => toast.error("Erro ao sincronizar remoção.", { icon: <AlertTriangle size={18}/> }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
  });

  // FINALIZAR COMPRA
  const finishMutation = useMutation({
    mutationFn: (payload) => api.post('/shopping-list/finish/', payload),
    retry: 3,
    onMutate: async (payload) => {
        await queryClient.cancelQueries();
        const prevList = queryClient.getQueryData(['shopping-list']);
        queryClient.setQueryData(['shopping-list'], old => old.filter(item => !item.is_purchased));
        setIsModalOpen(false);
        toast.success("Compra finalizada!");
        return { prevList };
    },
    onError: (err, payload, ctx) => {
        queryClient.setQueryData(['shopping-list'], ctx.prevList);
        toast.error("Falha ao finalizar. Tente novamente.");
    },
    onSettled: () => queryClient.invalidateQueries()
  });

  // --- HANDLERS ---
  const handleAddItem = (productId) => {
    const product = products.find(p => p.id == productId);
    // Gera ID aqui para poder rastrear depois
    const tempId = 'temp-' + Date.now();
    
    addMutation.mutate({ 
        tempId, // Passamos o ID temporário para a mutação rastrear
        product: productId, 
        product_name: product?.name, 
        quantity_to_buy: 1 
    });
  };
  
  const handleUpdateItem = (id, field, value) => {
    if (String(id).startsWith('temp-')) {
        // Atualiza Cache Local (Offline)
        queryClient.setQueryData(['shopping-list'], old => 
            old.map(item => item.id === id ? { ...item, [field]: value } : item)
        );
        return;
    }
    updateMutation.mutate({ id, field, value });
  };

  const handleDeleteItem = (id) => {
    if (String(id).startsWith('temp-')) {
        queryClient.setQueryData(['shopping-list'], old => old.filter(i => i.id !== id));
        toast.success("Removido.");
        return;
    }
    if (window.confirm("Remover item?")) deleteMutation.mutate(id);
  };

  const confirmFinish = () => {
    if (!selectedSource) return toast.error("Selecione onde debitar.");
    finishMutation.mutate({
        payment_method: paymentMethod,
        source_id: selectedSource,
        total_value: totals.discount > 0 ? totals.discount : totals.real,
        date: new Date().toISOString().split('T')[0]
    });
  };

  const openPaymentModal = () => {
    if (!items.some(i => i.is_purchased)) return toast.error("Nenhum item marcado.");
    if (accounts.length) { setPaymentMethod('ACCOUNT'); setSelectedSource(accounts[0].id); }
    else if (cards.length) { setPaymentMethod('CREDIT_CARD'); setSelectedSource(cards[0].id); }
    else { setPaymentMethod(''); setSelectedSource(''); }
    setModalView('PAYMENT_CONFIRM');
    setIsModalOpen(true);
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans bg-gray-50 dark:bg-[#0F172A] dark:text-gray-100">
      <div className="hidden md:block h-full shrink-0 relative z-20"><Sidebar /></div>
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ShoppingCart className="text-teal-500" /> Lista de Compras
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={() => queryClient.invalidateQueries(['shopping-list'])} className="bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 p-3 rounded-xl shadow border border-gray-200 dark:border-slate-700 transition active:scale-95 hover:bg-gray-50">
                            <RefreshCw size={24} className={isRefetching ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => { setModalView('PRODUCT_SELECT'); setIsModalOpen(true); }} className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl shadow-lg transition active:scale-95">
                            <Plus size={24} />
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 md:gap-3 mb-2">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                        <p className="text-[9px] md:text-[10px] text-gray-400 uppercase font-bold truncate">Estimado</p>
                        <p className="text-sm md:text-lg font-bold text-gray-700 dark:text-gray-300 truncate">R$ {totals.estimated.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm">
                        <p className="text-[9px] md:text-[10px] text-blue-400 uppercase font-bold truncate">Carrinho</p>
                        <p className="text-sm md:text-lg font-bold text-blue-600 dark:text-blue-400 truncate">R$ {totals.real.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
                        <p className="text-[9px] md:text-[10px] text-emerald-500 uppercase font-bold truncate">Final</p>
                        <p className="text-sm md:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">R$ {totals.discount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                </div>
            </header>

            <main className="px-4 md:px-8 pb-32 md:pb-10">
                <div className="space-y-4">
                    {items.map(item => (
                        <div key={item.id} className={`flex flex-col gap-3 md:gap-4 p-4 rounded-2xl border transition-all shadow-sm ${item.is_purchased ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-white dark:bg-[#1E293B] border-gray-100 dark:border-slate-700'} ${String(item.id).startsWith('temp') ? 'opacity-70 border-dashed border-orange-300' : ''}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <button onClick={() => handleUpdateItem(item.id, 'is_purchased', !item.is_purchased)} className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${item.is_purchased ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-emerald-400 dark:border-slate-500'}`}>
                                        <Check size={16} strokeWidth={3} />
                                    </button>
                                    <div className="min-w-0">
                                        <p className={`font-bold text-base md:text-lg truncate ${item.is_purchased ? 'text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-500/50' : 'text-gray-800 dark:text-gray-200'}`}>
                                            {item.product_name} 
                                            {String(item.id).startsWith('temp') && <span className="ml-2 text-[9px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Offline</span>}
                                        </p>
                                        <p className="text-[10px] md:text-xs text-gray-400">Est. Unit: R$ {Number(item.estimated_price).toFixed(2)}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteItem(item.id)} className="text-gray-400 hover:text-red-500 p-2 transition-colors"><Trash2 size={20} /></button>
                            </div>

                            <div className={`grid grid-cols-3 gap-2 md:gap-3 ${!item.is_purchased ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <div>
                                    <label className="block text-[9px] md:text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 truncate">Qtd.</label>
                                    <div className="flex items-center h-9 md:h-11 w-full rounded-lg md:rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm group focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                                        <button onClick={() => { const current = parseFloat(item.quantity_to_buy) || 0; if (current > 0) handleUpdateItem(item.id, 'quantity_to_buy', current - 1); }} className="h-full px-1 md:px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0" tabIndex="-1"><Minus size={14} strokeWidth={2.5} className="md:w-4 md:h-4 w-3 h-3" /></button>
                                        <input type="number" className="w-full h-full text-center bg-transparent border-none text-gray-800 dark:text-white font-bold outline-none text-xs md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.quantity_to_buy} onChange={(e) => handleUpdateItem(item.id, 'quantity_to_buy', e.target.value)} />
                                        <button onClick={() => { const current = parseFloat(item.quantity_to_buy) || 0; handleUpdateItem(item.id, 'quantity_to_buy', current + 1); }} className="h-full px-1 md:px-3 flex items-center justify-center text-teal-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors shrink-0" tabIndex="-1"><Plus size={14} strokeWidth={2.5} className="md:w-4 md:h-4 w-3 h-3" /></button>
                                    </div>
                                </div>
                                <div><label className="block text-[9px] md:text-[10px] font-bold text-blue-500 uppercase mb-1 ml-1 truncate">Real</label><MoneyInput value={item.real_unit_price} onValueChange={(val) => handleUpdateItem(item.id, 'real_unit_price', val)} placeholder="0,00" /></div>
                                <div><label className="block text-[9px] md:text-[10px] font-bold text-emerald-500 uppercase mb-1 ml-1 truncate">Desc.</label><MoneyInput value={item.discount_unit_price} onValueChange={(val) => handleUpdateItem(item.id, 'discount_unit_price', val)} placeholder="0,00" /></div>
                            </div>
                        </div>
                    ))}
                </div>
                {(!items || items.length === 0) && !loadingList && (
                    <div className="text-center py-10 text-gray-400">
                        <ShoppingCart size={48} className="mx-auto mb-3 opacity-50" />
                        <p>Lista de compras vazia.</p>
                        <button onClick={() => queryClient.invalidateQueries(['shopping-list'])} className="mt-4 text-teal-600 flex items-center gap-2 mx-auto text-sm font-bold border border-teal-200 px-4 py-2 rounded-lg hover:bg-teal-50 transition"><RefreshCw size={16}/> Sincronizar Agora</button>
                    </div>
                )}
            </main>
        </div>
        {items.some(i => i.is_purchased) && (
            <div className="absolute bottom-24 right-6 md:bottom-10 md:right-10 z-50 animate-bounce-in">
                <button onClick={openPaymentModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-full shadow-xl shadow-emerald-200 dark:shadow-none font-bold flex items-center gap-2 transition transform active:scale-95">
                    <CheckCircle size={24} /> <span className="hidden md:inline">Finalizar Compra</span> <span className="md:hidden">Finalizar</span>
                </button>
            </div>
        )}
      </div>
      <MobileMenu />
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalView === 'PAYMENT_CONFIRM' ? "Pagamento" : "Adicionar à Lista"}>
        {modalView === 'PRODUCT_SELECT' && <ManualAddForm onAdd={handleAddItem} onCreateNew={() => setModalView('CREATE_PRODUCT')} products={products} />}
        {modalView === 'CREATE_PRODUCT' && <ProductManager onBack={() => setModalView('PRODUCT_SELECT')} />}
        {modalView === 'PAYMENT_CONFIRM' && (
            <div className="space-y-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Valor Total da Compra</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">R$ {(totals.discount > 0 ? totals.discount : totals.real).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Método de Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setPaymentMethod('ACCOUNT'); setSelectedSource(accounts.length > 0 ? accounts[0].id : ''); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'ACCOUNT' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}><Wallet size={24} /><span className="text-sm font-bold">Débito / Conta</span></button>
                        <button onClick={() => { setPaymentMethod('CREDIT_CARD'); setSelectedSource(cards.length > 0 ? cards[0].id : ''); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'CREDIT_CARD' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}><CreditCard size={24} /><span className="text-sm font-bold">Cartão de Crédito</span></button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{paymentMethod === 'ACCOUNT' ? 'Selecionar Conta' : 'Selecionar Cartão'}</label>
                    <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500">
                        {paymentMethod === 'ACCOUNT' ? accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance})</option>) : cards.map(card => <option key={card.id} value={card.id}>{card.name} (Disp: R$ {card.limit_available})</option>)}
                        {((paymentMethod === 'ACCOUNT' && accounts.length === 0) || (paymentMethod === 'CREDIT_CARD' && cards.length === 0)) && (<option value="">Nenhuma opção disponível</option>)}
                    </select>
                </div>
                <button onClick={confirmFinish} disabled={finishMutation.isPending} className={`w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl hover:bg-teal-500 active:scale-95 transition shadow-lg flex items-center justify-center gap-2 ${finishMutation.isPending ? 'opacity-70 cursor-not-allowed' : ''}`}>Confirmar e Atualizar Estoque</button>
            </div>
        )}
      </Modal>
    </div>
  );
}

function ManualAddForm({ onAdd, onCreateNew, products }) {
    const [selected, setSelected] = useState('');
    return (
        <div className="space-y-4">
            <select className="w-full p-3 rounded-xl bg-gray-50 border dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={selected} onChange={e => setSelected(e.target.value)}>
                <option value="">Selecione um produto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => selected && onAdd(selected)} className="w-full bg-teal-600 text-white p-3 rounded-xl font-bold">Adicionar</button>
            <div className="text-center pt-2"><button onClick={onCreateNew} className="text-sm text-teal-600 underline">Cadastrar novo produto</button></div>
        </div>
    );
}