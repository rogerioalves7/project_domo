import { useEffect, useState } from 'react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import MobileMenu from '../components/MobileMenu';
import Modal from '../components/Modal';
import ProductManager from '../components/ProductManager';
import MoneyInput from '../components/MoneyInput';
import { 
  ShoppingCart, Check, Trash2, Plus, Minus, RefreshCw, CheckCircle, Wallet, CreditCard 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Shopping() {
  // --- ESTADOS DE DADOS ---
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]); 
  const [cards, setCards] = useState([]);       
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE UI ---
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [totalReal, setTotalReal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState('PRODUCT_SELECT'); 

  // --- ESTADOS DE PAGAMENTO ---
  const [paymentMethod, setPaymentMethod] = useState('ACCOUNT'); // 'ACCOUNT' ou 'CREDIT_CARD'
  const [selectedSource, setSelectedSource] = useState('');

  // --- CARREGAMENTO INICIAL ---
  async function loadData() {
    setLoading(true);
    try {
      // Busca tudo de uma vez para garantir que temos contas/cartões ao abrir o modal
      const [listRes, accRes, cardRes] = await Promise.all([
        api.get('/shopping-list/'),
        api.get('/accounts/'),
        api.get('/credit-cards/')
      ]);

      const listData = Array.isArray(listRes.data) ? listRes.data : [];
      setItems(listData);
      setAccounts(accRes.data);
      setCards(cardRes.data);
      
      calculateTotals(listData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro de conexão.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // --- CÁLCULOS ---
  function calculateTotals(currentItems) {
    let est = 0;
    let real = 0;
    let disc = 0;

    if (!currentItems || !Array.isArray(currentItems)) return;

    currentItems.forEach(item => {
        const qty = parseFloat(item?.quantity_to_buy || 0);
        const estUnit = parseFloat(item?.estimated_price || 0);
        const realUnit = parseFloat(item?.real_unit_price || 0);
        const discUnit = parseFloat(item?.discount_unit_price || 0);

        est += estUnit * qty;

        if (item?.is_purchased) {
            const finalRealPrice = realUnit > 0 ? realUnit : estUnit;
            const finalDiscPrice = discUnit > 0 ? discUnit : finalRealPrice;
            
            real += finalRealPrice * qty;
            disc += finalDiscPrice * qty;
        }
    });

    setTotalEstimated(est);
    setTotalReal(real);
    setTotalDiscount(disc);
  }

  // --- AÇÕES DO ITEM (Update, Delete) ---
  async function updateItem(id, field, value) {
    const newItems = items.map(i => i.id === id ? { ...i, [field]: value } : i);
    setItems(newItems);
    calculateTotals(newItems);
    try { await api.patch(`/shopping-list/${id}/`, { [field]: value }); } catch (e) { console.error(e); }
  }

  async function deleteItem(id) {
    try {
        await api.delete(`/shopping-list/${id}/`);
        const newItems = items.filter(i => i.id !== id);
        setItems(newItems);
        calculateTotals(newItems);
        toast.success("Item removido.");
    } catch (error) { toast.error("Erro ao remover."); }
  }

  async function addManualItem(productId) {
    try {
        await api.post('/shopping-list/', { product: productId, quantity_to_buy: 1 });
        toast.success("Adicionado!");
        setIsModalOpen(false);
        loadData(); 
    } catch (error) { toast.error("Erro ao adicionar."); }
  }

  // --- FLUXO DE PAGAMENTO ---
  function openPaymentModal() {
    const purchasedCount = items.filter(i => i.is_purchased).length;
    if (purchasedCount === 0) return toast.error("Marque itens como comprados.");
    
    // Define padrão inicial inteligente
    if (accounts.length > 0) {
        setPaymentMethod('ACCOUNT');
        setSelectedSource(accounts[0].id);
    } else if (cards.length > 0) {
        setPaymentMethod('CREDIT_CARD');
        setSelectedSource(cards[0].id);
    } else {
        setPaymentMethod('');
        setSelectedSource('');
    }

    setModalView('PAYMENT_CONFIRM');
    setIsModalOpen(true);
  }

  async function confirmFinish() {
    if (!selectedSource) return toast.error("Selecione onde debitar.");

    try {
        setLoading(true);
        const response = await api.post('/shopping-list/finish/', {
            payment_method: paymentMethod,
            source_id: selectedSource,
            // Envia o valor final (com desconto se houver, senão o real)
            total_value: totalDiscount > 0 ? totalDiscount : totalReal,
            date: new Date().toISOString().split('T')[0]
        });
        
        toast.success(response.data.message);
        setIsModalOpen(false);
        loadData(); // Recarrega para limpar lista e atualizar saldos
    } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.error || "Erro ao finalizar.");
    } finally {
        setLoading(false);
    }
  }

  // --- RENDERIZAÇÃO ---
  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans bg-gray-50 dark:bg-[#0F172A] dark:text-gray-100">
      
      {/* Sidebar Desktop */}
      <div className="hidden md:block h-full shrink-0 relative z-20"><Sidebar /></div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            
            {/* Header */}
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ShoppingCart className="text-teal-500" /> Lista de Compras
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={loadData} className="bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 p-3 rounded-xl shadow border border-gray-200 dark:border-slate-700 transition active:scale-95 hover:bg-gray-50">
                            <RefreshCw size={24} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => { setModalView('PRODUCT_SELECT'); setIsModalOpen(true); }} className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl shadow-lg transition active:scale-95">
                            <Plus size={24} />
                        </button>
                    </div>
                </div>
                
                {/* Totalizadores */}
                <div className="grid grid-cols-3 gap-2 md:gap-3 mb-2">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                        <p className="text-[9px] md:text-[10px] text-gray-400 uppercase font-bold truncate">Estimado</p>
                        <p className="text-sm md:text-lg font-bold text-gray-700 dark:text-gray-300 truncate">R$ {totalEstimated.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm">
                        <p className="text-[9px] md:text-[10px] text-blue-400 uppercase font-bold truncate">Carrinho</p>
                        <p className="text-sm md:text-lg font-bold text-blue-600 dark:text-blue-400 truncate">R$ {totalReal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
                        <p className="text-[9px] md:text-[10px] text-emerald-500 uppercase font-bold truncate">Final</p>
                        <p className="text-sm md:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">R$ {totalDiscount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                </div>
            </header>

            {/* Lista de Itens */}
            <main className="px-4 md:px-8 pb-32 md:pb-10">
                <div className="space-y-4">
                    {items && items.map(item => (
                        <div key={item.id} className={`flex flex-col gap-3 md:gap-4 p-4 rounded-2xl border transition-all shadow-sm ${item.is_purchased ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-white dark:bg-[#1E293B] border-gray-100 dark:border-slate-700'}`}>
                            
                            {/* Linha Superior */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <button onClick={() => updateItem(item.id, 'is_purchased', !item.is_purchased)} className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${item.is_purchased ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-emerald-400 dark:border-slate-500'}`}>
                                        <Check size={16} strokeWidth={3} />
                                    </button>
                                    <div className="min-w-0">
                                        <p className={`font-bold text-base md:text-lg truncate ${item.is_purchased ? 'text-emerald-700 dark:text-emerald-400 line-through decoration-emerald-500/50' : 'text-gray-800 dark:text-gray-200'}`}>{item.product_name}</p>
                                        <p className="text-[10px] md:text-xs text-gray-400">Est. Unit: R$ {Number(item.estimated_price).toFixed(2)}</p>
                                    </div>
                                </div>
                                <button onClick={() => deleteItem(item.id)} className="text-gray-400 hover:text-red-500 p-2 transition-colors"><Trash2 size={20} /></button>
                            </div>

                            {/* Linha Inferior (Inputs) */}
                            <div className={`grid grid-cols-3 gap-2 md:gap-3 ${!item.is_purchased ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                
                                {/* Stepper de Quantidade Integrado */}
                                <div>
                                    <label className="block text-[9px] md:text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1 truncate">Qtd.</label>
                                    <div className="flex items-center h-9 md:h-11 w-full rounded-lg md:rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm group focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                                        <button onClick={() => { const current = parseFloat(item.quantity_to_buy) || 0; if (current > 0) updateItem(item.id, 'quantity_to_buy', current - 1); }} className="h-full px-1 md:px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0" tabIndex="-1"><Minus size={14} strokeWidth={2.5} className="md:w-4 md:h-4 w-3 h-3" /></button>
                                        <input type="number" className="w-full h-full text-center bg-transparent border-none text-gray-800 dark:text-white font-bold outline-none text-xs md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.quantity_to_buy} onChange={(e) => updateItem(item.id, 'quantity_to_buy', e.target.value)} />
                                        <button onClick={() => { const current = parseFloat(item.quantity_to_buy) || 0; updateItem(item.id, 'quantity_to_buy', current + 1); }} className="h-full px-1 md:px-3 flex items-center justify-center text-teal-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors shrink-0" tabIndex="-1"><Plus size={14} strokeWidth={2.5} className="md:w-4 md:h-4 w-3 h-3" /></button>
                                    </div>
                                </div>

                                {/* Valor Real */}
                                <div>
                                    <label className="block text-[9px] md:text-[10px] font-bold text-blue-500 uppercase mb-1 ml-1 truncate">Real</label>
                                    <MoneyInput value={item.real_unit_price} onValueChange={(val) => updateItem(item.id, 'real_unit_price', val)} placeholder="0,00" />
                                </div>

                                {/* Valor Desconto */}
                                <div>
                                    <label className="block text-[9px] md:text-[10px] font-bold text-emerald-500 uppercase mb-1 ml-1 truncate">Desc.</label>
                                    <MoneyInput value={item.discount_unit_price} onValueChange={(val) => updateItem(item.id, 'discount_unit_price', val)} placeholder="0,00" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {(!items || items.length === 0) && !loading && (
                    <div className="text-center py-10 text-gray-400">
                        <ShoppingCart size={48} className="mx-auto mb-3 opacity-50" />
                        <p>Lista de compras vazia.</p>
                        <button onClick={loadData} className="mt-4 text-teal-600 flex items-center gap-2 mx-auto text-sm font-bold border border-teal-200 px-4 py-2 rounded-lg hover:bg-teal-50 transition">
                            <RefreshCw size={16}/> Sincronizar Agora
                        </button>
                    </div>
                )}
            </main>
        </div>

        {/* FAB (Botão Finalizar) */}
        {items && items.some(i => i.is_purchased) && (
            <div className="absolute bottom-24 right-6 md:bottom-10 md:right-10 z-50 animate-bounce-in">
                <button 
                    onClick={openPaymentModal}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-full shadow-xl shadow-emerald-200 dark:shadow-none font-bold flex items-center gap-2 transition transform active:scale-95"
                >
                    <CheckCircle size={24} /> <span className="hidden md:inline">Finalizar Compra</span> <span className="md:hidden">Finalizar</span>
                </button>
            </div>
        )}
      </div>

      <MobileMenu />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalView === 'PAYMENT_CONFIRM' ? "Pagamento" : "Adicionar à Lista"}>
        
        {/* --- ADD PRODUCT --- */}
        {modalView === 'PRODUCT_SELECT' && <ManualAddForm onAdd={addManualItem} onCreateNew={() => setModalView('CREATE_PRODUCT')} />}
        {modalView === 'CREATE_PRODUCT' && <ProductManager onBack={() => setModalView('PRODUCT_SELECT')} />}
        
        {/* --- CONFIRM PAYMENT --- */}
        {modalView === 'PAYMENT_CONFIRM' && (
            <div className="space-y-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Valor Total da Compra</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        R$ {(totalDiscount > 0 ? totalDiscount : totalReal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Método de Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => {
                                setPaymentMethod('ACCOUNT');
                                // CORREÇÃO 1: Reseta o source para a primeira conta válida
                                setSelectedSource(accounts.length > 0 ? accounts[0].id : '');
                            }}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'ACCOUNT' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            <Wallet size={24} />
                            <span className="text-sm font-bold">Débito / Conta</span>
                        </button>
                        <button 
                            onClick={() => {
                                setPaymentMethod('CREDIT_CARD');
                                // CORREÇÃO 2: Reseta o source para o primeiro cartão válido
                                setSelectedSource(cards.length > 0 ? cards[0].id : '');
                            }}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'CREDIT_CARD' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            <CreditCard size={24} />
                            <span className="text-sm font-bold">Cartão de Crédito</span>
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {paymentMethod === 'ACCOUNT' ? 'Selecionar Conta' : 'Selecionar Cartão'}
                    </label>
                    <select 
                        value={selectedSource}
                        onChange={e => setSelectedSource(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        {paymentMethod === 'ACCOUNT' 
                            ? accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance})</option>)
                            : cards.map(card => <option key={card.id} value={card.id}>{card.name} (Disp: R$ {card.limit_available})</option>)
                        }
                        {((paymentMethod === 'ACCOUNT' && accounts.length === 0) || (paymentMethod === 'CREDIT_CARD' && cards.length === 0)) && (
                            <option value="">Nenhuma opção disponível</option>
                        )}
                    </select>
                </div>

                <button 
                    onClick={confirmFinish}
                    disabled={loading}
                    className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl hover:bg-teal-500 active:scale-95 transition shadow-lg flex items-center justify-center gap-2"
                >
                    {loading ? "Processando..." : "Confirmar e Atualizar Estoque"}
                </button>
            </div>
        )}
      </Modal>
    </div>
  );
}

// Subcomponente
function ManualAddForm({ onAdd, onCreateNew }) {
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState('');
    useEffect(() => { api.get('/products/').then(r => setProducts(r.data)).catch(() => {}); }, []);
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