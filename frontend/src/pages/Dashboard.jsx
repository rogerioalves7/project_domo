import { useState, useContext, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import Modal from '../components/Modal';
import NewAccountForm from '../components/NewAccountForm';
import NewCreditCardForm from '../components/NewCreditCardForm';
import NewRecurringBillForm from '../components/NewRecurringBillForm';
import NewTransactionForm from '../components/NewTransactionForm';
import CategoryManager from '../components/CategoryManager';
import Sidebar from '../components/Sidebar';
import MoneyInput from '../components/MoneyInput';
import MobileMenu from '../components/MobileMenu';
import Skeleton from '../components/Skeleton';
import { PrivateValue } from '../components/ui/PrivateValue';
import logoImg from '../assets/logo.png';
import { 
  Plus, ArrowUpCircle, ArrowDownCircle, CreditCard, Wallet, 
  Sun, Moon, Calendar, TrendingUp, ArrowUpRight, ArrowDownLeft, 
  ShoppingBag, CheckCircle2, AlertCircle, FileText, Lock, Users, User 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  
  // --- ESTADOS DE UI ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState('MENU'); 
  const [lastModalView, setLastModalView] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [transactionType, setTransactionType] = useState('EXPENSE');
  const [viewTransaction, setViewTransaction] = useState(null);

  const [billToPay, setBillToPay] = useState(null);
  const [invoiceToPay, setInvoiceToPay] = useState(null);
  const [paymentValue, setPaymentValue] = useState('');
  const [payMethod, setPayMethod] = useState('ACCOUNT');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [paymentCard, setPaymentCard] = useState('');

  // --- 1. QUERIES (LEITURA) ---
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts/').then(res => res.data),
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: () => api.get('/credit-cards/').then(res => res.data),
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['recurring-bills'],
    queryFn: () => api.get('/recurring-bills/').then(res => res.data),
  });

  const { data: transactions = [], isLoading: loadingTrans } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get('/transactions/').then(res => res.data),
  });

  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/me/').then(res => res.data),
  });

  const loading = loadingAccounts || loadingCards || loadingBills || loadingTrans || loadingUser;

  // --- 2. DADOS DERIVADOS ---
  const totalBalance = useMemo(() => accounts.reduce((acc, item) => acc + Number(item.balance), 0), [accounts]);
  const totalInvoices = useMemo(() => cards.reduce((acc, card) => acc + (Number(card.invoice_info?.value) || 0), 0), [cards]);
  
  const totalFixedBills = useMemo(() => recurringBills.reduce((acc, bill) => {
      if (bill.is_paid_this_month) return acc; 
      return acc + Number(bill.base_value);
  }, 0), [recurringBills]);

  const totalForecast = totalInvoices + totalFixedBills;
  const freeBalance = totalBalance - totalForecast;

  const recentTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return transactions
      .filter(t => {
          const tDate = new Date(t.date + 'T12:00:00');
          if (tDate > today) return false;
          return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15);
  }, [transactions]);

  // --- 3. MUTAÇÕES ---

  // A. PAGAR CONTA FIXA
  const payBillMutation = useMutation({
    mutationFn: (payload) => api.post('/transactions/', payload),
    retry: 3, 
    onMutate: async (newTx) => {
        await queryClient.cancelQueries({ queryKey: ['recurring-bills'] });
        await queryClient.cancelQueries({ queryKey: ['accounts'] });
        await queryClient.cancelQueries({ queryKey: ['transactions'] });

        const prevBills = queryClient.getQueryData(['recurring-bills']);
        const prevAccounts = queryClient.getQueryData(['accounts']);
        const prevTrans = queryClient.getQueryData(['transactions']);

        queryClient.setQueryData(['recurring-bills'], (old) => 
            old?.map(bill => bill.id === newTx.recurring_bill ? { ...bill, is_paid_this_month: true } : bill)
        );

        queryClient.setQueryData(['accounts'], (old) => 
            old?.map(acc => acc.id === newTx.account ? { ...acc, balance: Number(acc.balance) - Number(newTx.value) } : acc)
        );

        queryClient.setQueryData(['transactions'], (old) => {
             const tempTx = {
                id: 'temp-' + Math.random(),
                description: newTx.description,
                value: newTx.value,
                type: 'EXPENSE',
                date: newTx.date,
                category_name: 'Conta Fixa',
                source_name: 'Sincronizando...',
                owner_name: 'Você',
                created_at: new Date().toISOString()
             };
             return [tempTx, ...(old || [])];
        });

        setIsModalOpen(false);
        toast.success("Conta paga! (Sincronizando...)");
        return { prevBills, prevAccounts, prevTrans };
    },
    onError: (err, newTx, context) => {
        queryClient.setQueryData(['recurring-bills'], context.prevBills);
        queryClient.setQueryData(['accounts'], context.prevAccounts);
        queryClient.setQueryData(['transactions'], context.prevTrans);
        toast.error("Erro ao pagar conta.");
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['recurring-bills'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  });

  // B. PAGAR FATURA
  const payInvoiceMutation = useMutation({
    mutationFn: async (payload) => {
        if (payload.paymentMethod === 'ACCOUNT') {
            return api.post(`/invoices/${payload.invoiceId}/pay/`, {
                account_id: payload.sourceId,
                value: payload.value,
                date: payload.date
            });
        } else {
            await api.post('/transactions/', {
                description: `Pagamento Fatura ${payload.cardName}`,
                value: payload.value,
                type: 'EXPENSE',
                payment_method: 'CREDIT_CARD',
                card: payload.sourceId,
                installments: 1,
                date: payload.date
            });
            await api.patch(`/invoices/${payload.invoiceId}/`, { status: 'PAID' });
            const newAvailable = parseFloat(payload.currentLimitAvailable) + parseFloat(payload.value);
            const finalAvailable = newAvailable > parseFloat(payload.limitTotal) ? parseFloat(payload.limitTotal) : newAvailable;
            return api.patch(`/credit-cards/${payload.cardId}/`, { limit_available: finalAvailable });
        }
    },
    retry: 3,
    onMutate: async (payload) => {
        await queryClient.cancelQueries({ queryKey: ['accounts'] });
        await queryClient.cancelQueries({ queryKey: ['credit-cards'] });
        await queryClient.cancelQueries({ queryKey: ['transactions'] });

        const prevAccounts = queryClient.getQueryData(['accounts']);
        const prevCards = queryClient.getQueryData(['credit-cards']);
        const prevTrans = queryClient.getQueryData(['transactions']);

        if (payload.paymentMethod === 'ACCOUNT') {
            queryClient.setQueryData(['accounts'], old => old?.map(acc => 
                acc.id === payload.sourceId ? { ...acc, balance: Number(acc.balance) - Number(payload.value) } : acc
            ));
        } else {
            queryClient.setQueryData(['credit-cards'], old => old?.map(card => 
                card.id === payload.sourceId ? { ...card, limit_available: Number(card.limit_available) - Number(payload.value) } : card
            ));
        }

        queryClient.setQueryData(['credit-cards'], old => old?.map(card => {
            if (card.id === payload.cardId) {
                let newLimit = Number(card.limit_available) + Number(payload.value);
                if (newLimit > Number(card.limit_total)) newLimit = Number(card.limit_total);
                // OTIMISMO: Zera a fatura atual
                const newInvoice = { ...card.invoice_info, status: 'PAID', value: 0 };
                return { ...card, limit_available: newLimit, invoice_info: newInvoice };
            }
            return card;
        }));

        queryClient.setQueryData(['transactions'], old => {
             const tempTx = {
                id: 'temp-' + Math.random(),
                description: `Pagamento Fatura ${payload.cardName}`,
                value: payload.value,
                type: 'EXPENSE',
                date: payload.date,
                category_name: 'Pagamento Fatura',
                source_name: 'Sincronizando...',
                owner_name: 'Você',
                created_at: new Date().toISOString()
             };
             return [tempTx, ...(old || [])];
        });

        setIsModalOpen(false);
        toast.success("Fatura paga! (Sincronizando...)");
        return { prevAccounts, prevCards, prevTrans };
    },
    onError: (err, vars, context) => {
        queryClient.setQueryData(['accounts'], context.prevAccounts);
        queryClient.setQueryData(['credit-cards'], context.prevCards);
        queryClient.setQueryData(['transactions'], context.prevTrans);
        toast.error("Erro ao pagar fatura.");
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  });

  // --- ACTIONS GERAIS ---
  function refreshData() { queryClient.invalidateQueries(); }

  async function handleToggleAccountPrivacy(e, account) {
    e.stopPropagation(); 
    const newStatus = !account.is_shared;
    queryClient.setQueryData(['accounts'], old => 
        old.map(acc => acc.id === account.id ? { ...acc, is_shared: newStatus } : acc)
    );
    try {
        await api.patch(`/accounts/${account.id}/`, { is_shared: newStatus });
        toast.success(newStatus ? "Conta agora é Compartilhada" : "Conta agora é Privada", { icon: newStatus ? '👥' : '🔒' });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
    } catch (error) {
        toast.error("Erro ao atualizar privacidade.");
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
  }

  async function handleToggleCardPrivacy(e, card) {
    e.stopPropagation(); 
    const newStatus = !card.is_shared;
    queryClient.setQueryData(['credit-cards'], old => 
        old.map(c => c.id === card.id ? { ...c, is_shared: newStatus } : c)
    );
    try {
        await api.patch(`/credit-cards/${card.id}/`, { is_shared: newStatus });
        toast.success(newStatus ? "Cartão agora é Compartilhado" : "Cartão agora é Privado", { icon: newStatus ? '👥' : '🔒' });
        queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
    } catch (error) {
        toast.error("Erro ao atualizar privacidade.");
        queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
    }
  }

  // --- MODALS E HELPERS ---
  const openCategoryManager = (fromView) => { setLastModalView(fromView); setModalView('CATEGORY_MANAGER'); };
  const handleOpenForecastDetails = () => { setModalView('FORECAST_DETAILS'); setIsModalOpen(true); }

  const handleOpenPayInvoice = (card) => {
    if (!card.invoice_info || !card.invoice_info.id) return toast.error("Sem fatura aberta.");
    setInvoiceToPay({ 
        invoiceId: card.invoice_info.id,
        cardId: card.id,
        name: card.name,
        value: card.invoice_info.value,
        limit_available: card.limit_available,
        limit_total: card.limit_total
    });
    setPaymentValue(card.invoice_info.value);
    setPayMethod('ACCOUNT');
    
    if (accounts.length > 0) setPaymentAccount(accounts[0].id);
    else setPaymentAccount('');

    const otherCards = cards.filter(c => c.id !== card.id);
    if (otherCards.length > 0) setPaymentCard(otherCards[0].id);
    setModalView('PAY_INVOICE'); setIsModalOpen(true);
  };

  const handleOpenPayModal = (bill) => {
    setBillToPay(bill); 
    setPaymentValue(bill.base_value);
    if (accounts.length > 0) setPaymentAccount(accounts[0].id);
    else setPaymentAccount('');
    setModalView('PAY_BILL'); setIsModalOpen(true);
  };

  const confirmPayment = (e) => {
    e.preventDefault(); 
    if (!paymentAccount) return toast.error("Selecione uma conta.");
    const finalValue = typeof paymentValue === 'string' ? parseFloat(paymentValue.replace(',', '.')) : paymentValue;
    
    payBillMutation.mutate({ 
        description: billToPay.name, 
        value: finalValue, 
        type: 'EXPENSE', 
        category: billToPay.category, 
        payment_method: 'ACCOUNT', 
        account: paymentAccount, 
        recurring_bill: billToPay.id, 
        date: new Date().toISOString().split('T')[0] 
    });
  };

  const confirmInvoicePayment = (e) => {
    e.preventDefault();
    if (payMethod === 'ACCOUNT' && !paymentAccount) return toast.error("Selecione uma conta.");
    if (payMethod === 'CARD' && !paymentCard) return toast.error("Selecione um cartão.");
    
    const finalValue = typeof paymentValue === 'string' ? parseFloat(paymentValue.replace(',', '.')) : paymentValue;
    
    payInvoiceMutation.mutate({
        paymentMethod: payMethod,
        sourceId: payMethod === 'ACCOUNT' ? paymentAccount : paymentCard,
        invoiceId: invoiceToPay.invoiceId,
        cardId: invoiceToPay.cardId,
        cardName: invoiceToPay.name,
        value: finalValue,
        date: new Date().toISOString().split('T')[0],
        currentLimitAvailable: invoiceToPay.limit_available,
        limitTotal: invoiceToPay.limit_total
    });
  };

  const openModalNew = () => { setEditingItem(null); setModalView('MENU'); setIsModalOpen(true); };
  const handleEditGeneric = (item, view) => { setEditingItem(item); setModalView(view); setIsModalOpen(true); };
  const handleNewTransaction = (type) => { setTransactionType(type); setModalView('NEW_TRANSACTION'); setIsModalOpen(true); };
  const handleViewDetails = (transaction) => { setViewTransaction(transaction); setModalView('VIEW_TRANSACTION'); setIsModalOpen(true); }
  
  const greetingName = currentUser?.first_name || currentUser?.username || user?.first_name || user?.username || 'Visitante';

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans transition-colors duration-300 bg-gray-50 text-gray-900 dark:bg-[#0F172A] dark:text-gray-100">
      <div className="hidden md:block h-full shrink-0 relative z-20"><Sidebar /></div>
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            <header className="w-full px-4 py-6 md:px-8 md:py-8 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <img src={logoImg} alt="Domo" className="h-10 w-auto object-contain md:hidden" />
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white truncate">
                          {loading ? <Skeleton className="h-8 w-48 mb-1" /> : `Olá, ${greetingName}!`}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">Visão geral das suas finanças</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0"><button onClick={toggleTheme} className="p-2.5 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 text-yellow-500 dark:text-yellow-400">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button></div>
            </header>
            <main className="w-full px-4 md:px-8 pb-32 md:pb-10 space-y-8">

                {/* RESUMO */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CARD SALDO */}
                    <div className="lg:col-span-2 bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-900/50 dark:to-teal-800/50 rounded-3xl p-6 shadow-lg shadow-teal-500/20 dark:shadow-none text-white flex justify-between items-center relative overflow-hidden h-44">
                        <div className="z-10 relative w-full">
                            <p className="text-teal-100 text-sm font-medium mb-1 flex items-center gap-2"><TrendingUp size={16}/> Saldo Bancário Total</p>
                            {loading ? (
                                <Skeleton className="h-12 w-64 bg-teal-400/30 dark:bg-teal-800/30 my-2" />
                            ) : (
                                <p className="text-4xl font-bold tracking-tight">
                                   <PrivateValue>R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                                </p>
                            )}
                            {loading ? (
                                <Skeleton className="h-6 w-48 bg-teal-400/30 dark:bg-teal-800/30 mt-2" />
                            ) : (
                                <p className="text-xs text-teal-200 mt-2 bg-teal-800/30 px-2 py-1 rounded inline-block">
                                    Saldo Livre Est.: <PrivateValue>R$ {freeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                                </p>
                            )}
                        </div>
                        <div className="hidden sm:block bg-white/20 p-3 rounded-2xl backdrop-blur-sm z-10"><Wallet className="w-8 h-8 text-white" /></div>
                        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-teal-400/20 to-transparent pointer-events-none"></div>
                    </div>

                    {/* CARD PREVISÃO */}
                    <div className="flex flex-col gap-4 h-44">
                        <div onClick={handleOpenForecastDetails} className="flex-1 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 rounded-3xl p-4 flex flex-col justify-center relative overflow-hidden cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                            <div className="flex justify-between items-start mb-1"><p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase flex items-center gap-1"><AlertCircle size={12}/> Previsão Gastos</p></div>
                            {loading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-32" />
                                    <Skeleton className="h-3 w-40" />
                                </div>
                            ) : (
                                <>
                                    <p className="text-2xl font-bold text-rose-500">
                                        <PrivateValue>R$ {totalForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">Faturas ({cards.length}) + Pendentes ({recurringBills.filter(b => !b.is_paid_this_month).length})</p>
                                </>
                            )}
                            <div className="absolute right-3 top-3"><FileText size={16} className="text-gray-300" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 flex-1">
                            <button onClick={() => handleNewTransaction('INCOME')} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex flex-col items-center justify-center gap-1 hover:brightness-95 transition border border-emerald-100 dark:border-emerald-800/50 font-bold text-xs"><ArrowUpCircle size={20}/> Receita</button>
                            <button onClick={() => handleNewTransaction('EXPENSE')} className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl flex flex-col items-center justify-center gap-1 hover:brightness-95 transition border border-rose-100 dark:border-rose-800/50 font-bold text-xs"><ArrowDownCircle size={20}/> Despesa</button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 px-1">
                    <div className="flex items-center gap-1.5"><Lock size={12} className="text-gray-400" /><span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Privado</span></div>
                    <div className="flex items-center gap-1.5"><Users size={12} className="text-blue-500" /><span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">Compartilhado</span></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CONTAS LISTA */}
                    <div>
                        <div className="flex justify-between items-center mb-4 px-1"><h2 className="font-bold text-gray-700 dark:text-gray-300">Minhas Contas</h2><button onClick={() => { setEditingItem(null); setModalView('ACCOUNT'); setIsModalOpen(true); }} className="bg-white dark:bg-[#1E293B] text-teal-600 text-xs font-bold hover:underline">+ Adicionar</button></div>
                        <div className="space-y-3">
                            {loading ? ([1, 2, 3].map(i => (<div key={i} className="p-4 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm min-h-[85px]"><Skeleton className="h-10 w-full" /></div>))) : (
                                accounts.map(acc => (
                                    <div key={acc.id} onClick={() => handleEditGeneric(acc, 'ACCOUNT')} className="cursor-pointer flex justify-between items-center p-4 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm hover:scale-[1.01] transition-transform min-h-[85px]">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${acc.is_shared ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'} dark:bg-slate-800`}><Wallet size={18} /></div>
                                            <div><p className="font-bold text-sm">{acc.name}</p><div className="flex items-center gap-2 mt-0.5"><button onClick={(e) => handleToggleAccountPrivacy(e, acc)} className={`p-1 rounded-md transition-colors ${acc.is_shared ? 'bg-white dark:bg-[#1E293B] text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'bg-white dark:bg-[#1E293B] text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>{acc.is_shared ? <Users size={12} /> : <Lock size={12} />}</button></div></div>
                                        </div>
                                        <span className="font-bold text-gray-800 dark:text-gray-200"><PrivateValue>R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue></span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* CARTÕES LISTA (CORRIGIDO LÓGICA DE FATURA E DATA) */}
                    <div>
                        <div className="flex justify-between items-center mb-4 px-1"><h2 className="font-bold text-gray-700 dark:text-gray-300">Meus Cartões</h2><button onClick={() => { setEditingItem(null); setModalView('CARD'); setIsModalOpen(true); }} className="bg-white dark:bg-[#1E293B] text-purple-600 text-xs font-bold hover:underline">+ Adicionar</button></div>
                        <div className="space-y-3">
                            {loading ? ([1, 2, 3].map(i => (<div key={i} className="p-4 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm min-h-[85px]"><Skeleton className="h-10 w-full" /></div>))) : (
                                cards.map(card => {
                                    const invoiceVal = card.invoice_info?.value || 0; 
                                    const today = new Date();
                                    
                                    // CORREÇÃO CRÍTICA DE DATAS E STATUS
                                    let monthName = "";
                                    let isFutureInvoice = false;

                                    if (card.invoice_info?.reference_date) {
                                        // Garante fuso horário local ao interpretar YYYY-MM-DD
                                        const refDate = new Date(card.invoice_info.reference_date + 'T12:00:00');
                                        
                                        // Nome do Mês
                                        monthName = refDate.toLocaleString('pt-BR', { month: 'long' });
                                        monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                                        // Verifica se é fatura futura (ano maior ou mês maior no mesmo ano)
                                        isFutureInvoice = 
                                            refDate.getFullYear() > today.getFullYear() || 
                                            (refDate.getFullYear() === today.getFullYear() && refDate.getMonth() > today.getMonth());
                                    }

                                    // Lógica de "Visualmente Fechada"
                                    // SÓ É FECHADA SE: (Não for futura) E (Hoje >= Dia Fechamento)
                                    const isVisuallyClosed = !isFutureInvoice && (today.getDate() >= card.closing_day);
                                    
                                    const apiStatus = card.invoice_info?.status || 'OPEN';
                                    const invoiceStatus = (isVisuallyClosed && apiStatus !== 'PAID') ? 'Fechada' : (apiStatus === 'PAID' ? 'Paga' : 'Aberta');
                                    
                                    const statusColor = invoiceStatus === 'Fechada' ? 'text-red-600' : (invoiceStatus === 'Paga' ? 'text-emerald-600' : 'text-rose-500');
                                    const avail = Number(card.limit_available); 
                                    const total = Number(card.limit_total); 
                                    const percentage = total === 0 ? 0 : Math.min(100, Math.max(0, (avail / total) * 100)); 
                                    
                                    return (
                                        <div key={card.id} onClick={() => handleEditGeneric(card, 'CARD')} className="cursor-pointer flex justify-between items-center p-4 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm hover:scale-[1.01] transition-transform min-h-[85px]">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600"><CreditCard size={18} /></div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{card.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <button onClick={(e) => handleToggleCardPrivacy(e, card)} className={`p-1 rounded-md transition-colors ${card.is_shared ? 'bg-white dark:bg-[#1E293B] text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'bg-white dark:bg-[#1E293B] text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`} title={card.is_shared ? "Compartilhado" : "Privado"}>{card.is_shared ? <Users size={12} /> : <Lock size={12} />}</button>
                                                        {Number(invoiceVal) > 0 ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex flex-col leading-tight">
                                                                    <p className={`text-[10px] font-bold ${statusColor}`}>
                                                                        {/* MOSTRA O NOME DO MÊS */}
                                                                        {monthName && <span className="text-gray-500 font-medium mr-1">Fatura {monthName}:</span>}
                                                                        {invoiceStatus} <PrivateValue>R$ {Number(invoiceVal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                                                                    </p>
                                                                    <p className="text-[9px] text-gray-400 font-medium">Vence dia {card.due_day}</p>
                                                                </div>
                                                                {/* SÓ MOSTRA BOTÃO SE ESTIVER FECHADA */}
                                                                {invoiceStatus === 'Fechada' && (
                                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenPayInvoice(card); }} className="ml-1 px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded hover:bg-rose-700 transition active:scale-95 shadow-sm">Pagar</button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col leading-tight"><p className="text-[10px] text-emerald-500 font-bold">Fatura em dia</p><p className="text-[9px] text-gray-400 font-medium">Vence dia {card.due_day}</p></div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right min-w-[80px]">
                                                <span className="font-bold text-gray-800 dark:text-gray-200 block text-sm"><PrivateValue>R$ {avail.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue></span>
                                                <span className="text-[10px] text-gray-400">Disp.</span>
                                                <div className="w-full h-1 bg-gray-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-400 to-blue-500" style={{ width: `${percentage}%` }} /></div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* RESTO DO DASHBOARD (CONTAS FIXAS / HISTÓRICO) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <div className="flex justify-between items-center mb-4 px-1"><h2 className="font-bold text-gray-700 dark:text-gray-300">Contas Fixas</h2><button onClick={() => { setEditingItem(null); setModalView('RECURRING'); setIsModalOpen(true); }} className="bg-white dark:bg-[#1E293B] text-orange-600 text-xs font-bold hover:underline">+ Adicionar</button></div>
                        <div className="space-y-2">
                            {loading ? ([1, 2, 3].map(i => (<div key={i} className="p-3 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 rounded-xl"><Skeleton className="h-8 w-full"/></div>))) : (
                                recurringBills.length === 0 ? (<p className="text-center text-gray-400 text-xs py-4 border border-dashed border-gray-200 rounded-xl">Nenhuma conta fixa.</p>) : (
                                    recurringBills.map(bill => (
                                    <div key={bill.id} className={`flex justify-between items-center p-3 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700/50 rounded-xl shadow-sm ${bill.is_paid_this_month ? 'opacity-70' : ''}`}>
                                        <div onClick={() => handleEditGeneric(bill, 'RECURRING')} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition">
                                            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600"><Calendar size={16}/></div>
                                            <div><p className="font-bold text-sm text-gray-800 dark:text-gray-200">{bill.name}</p><p className="text-xs text-gray-500">{bill.category_name || 'Geral'} • Dia {bill.due_day} • <PrivateValue>R$ {Number(bill.base_value).toLocaleString('pt-BR')}</PrivateValue></p></div>
                                        </div>
                                        {!bill.is_paid_this_month ? (<button onClick={(e) => { e.stopPropagation(); handleOpenPayModal(bill); }} className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-lg hover:bg-emerald-500 hover:text-white transition">Pagar</button>) : (<span className="text-[10px] font-bold text-emerald-500 px-2 border border-emerald-100 rounded bg-emerald-50">Pago</span>)}
                                    </div>
                                    ))
                                )
                            )}
                        </div>
                    </div>
                    
                    <div className="lg:col-span-2">
                        <h2 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-4 px-1">Histórico Recente</h2>
                        <div className="space-y-2">
                            {loading ? ([1, 2, 3].map(i => (<div key={i} className="p-3 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 rounded-xl"><Skeleton className="h-10 w-full"/></div>))) : (
                                recentTransactions.length === 0 ? (<p className="text-center text-gray-500 text-sm py-8 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">Nenhuma movimentação.</p>) : (
                                    recentTransactions.map(t => {
                                        const isExpense = t.type === 'EXPENSE';
                                        const hasItems = t.items && t.items.length > 0;
                                        return (
                                            <div key={t.id} onClick={() => hasItems && handleViewDetails(t)} className={`flex justify-between items-center p-3 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700/50 rounded-xl shadow-sm transition-all ${hasItems ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-[0.99]' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full ${isExpense ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'} dark:bg-opacity-10`}>{isExpense ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate max-w-[150px] md:max-w-xs">{t.description}</p>
                                                        <div className="flex items-center gap-2 mt-0.5"><p className="text-xs text-gray-500">{new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {t.category_name || 'Geral'}</p>{hasItems && (<span className="flex items-center gap-1 text-[9px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50"><ShoppingBag size={10} /> {t.items.length} itens</span>)}</div>
                                                    </div>
                                                </div>
                                                <span className={`font-bold text-sm ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>{isExpense ? '- ' : '+ '} <PrivateValue>R$ {Number(t.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue></span>
                                            </div>
                                        );
                                    })
                                )
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
      </div>
      
      <button onClick={openModalNew} className="fixed bottom-24 md:bottom-10 right-4 md:right-10 p-4 rounded-full transition active:scale-90 z-50 text-white shadow-xl bg-teal-600 hover:bg-teal-500 shadow-teal-200 dark:bg-teal-500 dark:hover:bg-teal-400 dark:shadow-none"><Plus size={28} strokeWidth={2.5} /></button>
      <MobileMenu />
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalView === 'MENU' ? "Adicionar Novo" : modalView === 'ACCOUNT' ? (editingItem ? "Editar Conta" : "Nova Conta") : modalView === 'CARD' ? (editingItem ? "Editar Cartão" : "Novo Cartão") : modalView === 'RECURRING' ? (editingItem ? "Editar Recorrência" : "Nova Recorrência") : modalView === 'NEW_TRANSACTION' ? (transactionType === 'INCOME' ? "Nova Receita" : "Nova Despesa") : modalView === 'CATEGORY_MANAGER' ? "Categorias" : modalView === 'PAY_INVOICE' ? "Pagar Fatura" : modalView === 'VIEW_TRANSACTION' ? "Detalhes da Compra" : modalView === 'FORECAST_DETAILS' ? "Detalhamento da Previsão" : "Pagar Conta"}>
        {modalView === 'MENU' && <div className="grid grid-cols-1 gap-3"><MenuOption icon={Wallet} label="Conta Corrente" onClick={() => setModalView('ACCOUNT')} color="teal" /><MenuOption icon={CreditCard} label="Cartão de Crédito" onClick={() => setModalView('CARD')} color="purple" /><MenuOption icon={Calendar} label="Conta Recorrente" onClick={() => setModalView('RECURRING')} color="orange" /></div>}
        {modalView === 'ACCOUNT' && <NewAccountForm initialData={editingItem} onBack={!editingItem ? () => setModalView('MENU') : null} onSuccess={() => { setIsModalOpen(false); refreshData(); }} />}
        {modalView === 'CARD' && <NewCreditCardForm initialData={editingItem} onBack={!editingItem ? () => setModalView('MENU') : null} onSuccess={() => { setIsModalOpen(false); refreshData(); }} />}
        {modalView === 'RECURRING' && (<NewRecurringBillForm initialData={editingItem} onBack={!editingItem ? () => setModalView('MENU') : null} onManageCategories={() => openCategoryManager('RECURRING')} onSuccess={() => { setIsModalOpen(false); refreshData(); }} />)}
        {modalView === 'NEW_TRANSACTION' && (<NewTransactionForm type={transactionType} accounts={accounts} cards={cards} onManageCategories={() => openCategoryManager('NEW_TRANSACTION')} onSuccess={() => { setIsModalOpen(false); refreshData(); }} />)}
        {modalView === 'CATEGORY_MANAGER' && (<CategoryManager onBack={() => setModalView(lastModalView || 'MENU')} />)}
        {modalView === 'VIEW_TRANSACTION' && viewTransaction && (
            <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">
                            <PrivateValue>R$ {Number(viewTransaction.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{viewTransaction.description}</p>
                    </div>
                    <div className="text-right"><p className="text-xs text-gray-400">{new Date(viewTransaction.date).toLocaleDateString('pt-BR')}</p></div>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Itens da Lista</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {viewTransaction.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg">
                                <span className="text-sm text-gray-700 dark:text-gray-300">{item.quantity > 1 && <span className="font-bold mr-1">{Number(item.quantity).toString().replace('.',',')}x</span>}{item.description}</span>
                                <span className="font-bold text-sm text-gray-800 dark:text-white">
                                    <PrivateValue>R$ {Number(item.value).toFixed(2)}</PrivateValue>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        {modalView === 'FORECAST_DETAILS' && (
            <div className="space-y-6">
                <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 text-center">
                    <p className="text-sm text-rose-500 mb-1 font-bold">Total Previsto</p>
                    <p className="text-3xl font-bold text-gray-800 dark:text-white">
                        <PrivateValue>R$ {totalForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                    </p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1"><CreditCard size={12}/> Faturas de Cartão</h4>
                    {cards.filter(c => Number(c.invoice_info?.value) > 0).length === 0 ? (<p className="text-sm text-gray-400 italic ml-1">Nenhuma fatura com valor.</p>) : (
                        <div className="space-y-2">
                            {cards.filter(c => Number(c.invoice_info?.value) > 0).map(card => (
                                <div key={card.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{card.name}</span>
                                    <span className="font-bold text-sm text-rose-500">
                                        <PrivateValue>R$ {Number(card.invoice_info.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1"><Calendar size={12}/> Contas Fixas Pendentes</h4>
                    {recurringBills.filter(b => !b.is_paid_this_month).length === 0 ? (<p className="text-sm text-gray-400 italic ml-1">Tudo pago por aqui!</p>) : (
                        <div className="space-y-2">
                            {recurringBills.filter(b => !b.is_paid_this_month).map(bill => (
                                <div key={bill.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{bill.name}</span>
                                    <span className="font-bold text-sm text-gray-600 dark:text-gray-400">
                                        <PrivateValue>R$ {Number(bill.base_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</PrivateValue>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {modalView === 'PAY_BILL' && billToPay && (
            <form onSubmit={confirmPayment} className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pagando:</p>
                    <p className="font-bold text-lg text-gray-800 dark:text-white">{billToPay.name}</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor</label>
                    <MoneyInput value={paymentValue} onValueChange={setPaymentValue} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Conta para débito</label>
                    <div className="relative">
                        <select className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 appearance-none" value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} required>
                            {accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} (R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</option>))}
                        </select>
                        <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400"><ArrowDownCircle size={16} /></div>
                    </div>
                </div>
                <button type="submit" disabled={payBillMutation.isPending} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-500 active:scale-95 transition shadow-lg shadow-teal-500/20">Confirmar Pagamento</button>
            </form>
        )}

        {modalView === 'PAY_INVOICE' && invoiceToPay && (<form onSubmit={confirmInvoicePayment} className="space-y-4"><div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30"><p className="text-sm text-rose-500 mb-1 font-bold">Fatura do Cartão:</p><p className="font-bold text-lg text-gray-800 dark:text-white">{invoiceToPay.name}</p></div><div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor a Pagar</label><MoneyInput value={paymentValue} onValueChange={setPaymentValue} /></div><div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pagar usando:</label><div className="grid grid-cols-2 gap-3 mb-3"><button type="button" onClick={() => setPayMethod('ACCOUNT')} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${payMethod === 'ACCOUNT' ? 'bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400' : 'bg-white border-gray-200 text-gray-500 dark:bg-slate-800 dark:border-slate-700'}`}><div className="flex items-center gap-2 mb-1"><Wallet size={18} /><span className="font-bold text-sm">Saldo</span></div>{payMethod === 'ACCOUNT' && <CheckCircle2 size={16} className="text-teal-500" />}</button><button type="button" onClick={() => setPayMethod('CARD')} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${payMethod === 'CARD' ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' : 'bg-white border-gray-200 text-gray-500 dark:bg-slate-800 dark:border-slate-700'}`}><div className="flex items-center gap-2 mb-1"><CreditCard size={18} /><span className="font-bold text-sm">Outro Cartão</span></div>{payMethod === 'CARD' && <CheckCircle2 size={16} className="text-purple-500" />}</button></div>{payMethod === 'ACCOUNT' ? (<div className="relative"><select className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 appearance-none" value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} required>{accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} (R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</option>))}</select><div className="absolute right-3 top-3.5 pointer-events-none text-gray-400"><ArrowDownCircle size={16} /></div></div>) : (<div className="relative"><select className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 appearance-none" value={paymentCard} onChange={e => setPaymentCard(e.target.value)} required>{cards.filter(c => c.id !== invoiceToPay.cardId).map(c => (<option key={c.id} value={c.id}>{c.name} (Disp: R$ {Number(c.limit_available).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</option>))}{cards.filter(c => c.id !== invoiceToPay.cardId).length === 0 && (<option disabled>Sem outros cartões disponíveis</option>)}</select><div className="absolute right-3 top-3.5 pointer-events-none text-gray-400"><ArrowDownCircle size={16} /></div></div>)}</div><button type="submit" className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl hover:bg-rose-500 active:scale-95 transition shadow-lg shadow-rose-500/20">Confirmar Pagamento</button></form>)}
      </Modal>
    </div>
  );
}

function MenuOption({ icon: Icon, label, onClick, color }) {
    const colors = { teal: 'bg-teal-100 text-teal-600', purple: 'bg-purple-100 text-purple-600', orange: 'bg-orange-100 text-orange-600' };
    return (<button onClick={onClick} className="flex items-center justify-between p-4 rounded-xl border transition-all bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-slate-900 dark:border-slate-700 dark:text-white"><div className="flex items-center gap-4"><div className={`p-3 rounded-full ${colors[color]}`}><Icon size={24} /></div><p className="font-bold">{label}</p></div></button>);
}