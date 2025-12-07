import { useEffect, useState, useContext } from 'react';
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
import logoImg from '../assets/logo.png';
import { 
  Home, BarChart3, Box, ShoppingCart, Settings, 
  Plus, ArrowUpCircle, ArrowDownCircle, CreditCard, Wallet, 
  Sun, Moon, ChevronRight, Users, Lock, Repeat, CheckCircle, Circle, Calendar, TrendingUp, DollarSign, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  
  // --- ESTADOS ---
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [recurringBills, setRecurringBills] = useState([]);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- UI ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState('MENU'); 
  const [editingItem, setEditingItem] = useState(null);
  const [transactionType, setTransactionType] = useState('EXPENSE');

  // --- PAGAMENTO ---
  const [billToPay, setBillToPay] = useState(null);
  const [invoiceToPay, setInvoiceToPay] = useState(null);
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [accRes, cardRes, billRes, transRes] = await Promise.all([
        api.get('/accounts/'),
        api.get('/credit-cards/'),
        api.get('/recurring-bills/'),
        api.get('/transactions/') 
      ]);

      setAccounts(accRes.data);
      setCards(cardRes.data);
      setRecurringBills(billRes.data);
      
      const allTrans = transRes.data;
      
      const now = new Date();
      const currentMonthTrans = allTrans.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      });
      setCurrentMonthTransactions(currentMonthTrans);

      const recent = allTrans
        .filter(t => {
            // Filtro para mostrar apenas o primeiro lançamento de parcelas
            const match = t.description.match(/\((\d+)\/(\d+)\)/);
            if (match) return match[1] === '1'; 
            return true;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
        
      setRecentTransactions(recent);

    } catch (error) {
      console.error("Erro ao buscar dados", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  // --- HANDLERS PAGAMENTO FATURA ---
  const handleOpenPayInvoice = (card) => {
    if (!card.invoice_info || !card.invoice_info.id) {
        return toast.error("Não há fatura aberta para este cartão.");
    }
    setInvoiceToPay({
        id: card.invoice_info.id,
        cardName: card.name,
        value: card.invoice_info.value,
        cardId: card.id,
        currentLimit: card.limit_available
    });
    setPaymentValue(card.invoice_info.value);
    if (accounts.length > 0) setPaymentAccount(accounts[0].id);
    setModalView('PAY_INVOICE');
    setIsModalOpen(true);
  };

  const confirmInvoicePayment = async (e) => {
    e.preventDefault();
    if (!paymentAccount) return toast.error("Selecione uma conta.");

    try {
        const finalValue = typeof paymentValue === 'string' ? parseFloat(paymentValue.replace(',', '.')) : paymentValue;

        // Note: A lógica idealmente deveria ser feita via endpoint de ação no backend (API PATCH)
        // para garantir a atomicidade da operação (Transação + Fatura + Limite).
        // Aqui, a chamada é feita para o endpoint de transações e a atualização de limite/fatura é simulada/feita via patches separados.

        await api.post('/transactions/', {
            description: `Pagamento Fatura ${invoiceToPay.cardName}`,
            value: finalValue,
            type: 'EXPENSE',
            account: paymentAccount,
            date: new Date().toISOString().split('T')[0],
            invoice: invoiceToPay.id
        });

        await api.patch(`/invoices/${invoiceToPay.id}/`, { status: 'PAID' });

        const newLimit = parseFloat(invoiceToPay.currentLimit) + parseFloat(finalValue);
        await api.patch(`/credit-cards/${invoiceToPay.cardId}/`, { limit_available: newLimit });

        toast.success("Fatura paga e limite restaurado!");
        setInvoiceToPay(null);
        setIsModalOpen(false);
        loadDashboardData();

    } catch (error) {
        console.error(error);
        toast.error("Erro ao processar pagamento.");
    }
  };

  // --- HANDLERS RECORRÊNCIA ---
  const checkBillStatus = (billId) => {
    // Procura se existe uma transação paga no mês corrente para esta conta recorrente
    const transaction = currentMonthTransactions.find(t => t.recurring_bill === billId);
    return transaction ? { paid: true, transaction } : { paid: false };
  };

  const handleOpenPayModal = (bill) => {
    setBillToPay(bill);
    setPaymentValue(bill.base_value);
    if (accounts.length > 0) setPaymentAccount(accounts[0].id);
    setModalView('PAY_BILL');
    setIsModalOpen(true);
  };

  const confirmPayment = async (e) => {
    e.preventDefault();
    if (!paymentAccount) return toast.error("Selecione uma conta.");

    try {
        const finalValue = typeof paymentValue === 'string' ? parseFloat(paymentValue.replace(',', '.')) : paymentValue;

        await api.post('/transactions/', {
            description: billToPay.name,
            value: finalValue,
            type: 'EXPENSE',
            category: billToPay.category,
            account: paymentAccount,
            recurring_bill: billToPay.id,
            date: new Date().toISOString().split('T')[0]
        });

        toast.success("Conta paga com sucesso!");
        setBillToPay(null);
        setIsModalOpen(false);
        loadDashboardData();
    } catch (error) {
        console.error(error);
        toast.error("Erro ao realizar pagamento.");
    }
  };

  // --- HANDLERS GERAIS ---
  const openModalNew = () => {
    setEditingItem(null);
    setModalView('MENU');
    setIsModalOpen(true);
  };

  const handleEditGeneric = (item, view) => {
    setEditingItem(item);
    setModalView(view);
    setIsModalOpen(true);
  };

  const handleNewTransaction = (type) => {
    setTransactionType(type);
    setModalView('NEW_TRANSACTION');
    setIsModalOpen(true);
  };

  const totalBalance = accounts.reduce((acc, item) => acc + Number(item.balance), 0);
  // Garante que o username está sendo usado para a saudação
  const greetingName = user?.username || user?.email?.split('@')[0] || 'Visitante';

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans transition-colors duration-300
                     bg-gray-50 text-gray-900 
                     dark:bg-[#0F172A] dark:text-gray-100">
      
      <div className="hidden md:block h-full shrink-0 relative z-20">
           <Sidebar />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            
            {/* HEADER */}
            <header className="w-full px-4 py-6 md:px-8 md:py-8 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <img src={logoImg} alt="Domo" className="h-10 w-auto object-contain md:hidden" />
                    <div>
                        {/* AQUI É O AJUSTE PRINCIPAL: Usando greetingName, que prioriza username */}
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white truncate">
                            Olá, {greetingName}!
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
                            Visão geral das suas finanças
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                    <button onClick={toggleTheme} className="p-2.5 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 text-yellow-500 dark:text-yellow-400">
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <div className="h-11 w-11 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-tr from-teal-400 to-blue-500 text-white font-bold text-lg">
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                </div>
            </header>

            <main className="w-full px-4 md:px-8 pb-32 md:pb-10 space-y-8">

                {/* 1. TOTALIZADOR */}
                <div className="w-full animate-fade-in-up">
                    <div className="bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-900/50 dark:to-teal-800/50 rounded-3xl p-6 shadow-lg shadow-teal-500/20 dark:shadow-none text-white flex justify-between items-center relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
                        <div>
                            <p className="text-teal-100 text-sm font-medium mb-1 flex items-center gap-2">
                                <TrendingUp size={16}/> Saldo Bancário Total
                            </p>
                            <p className="text-3xl md:text-4xl font-bold tracking-tight">
                                {loading ? "..." : `R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </p>
                        </div>
                        <div className="hidden md:block bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                            <Wallet className="w-8 h-8 text-white" />
                        </div>
                    </div>
                </div>

                {/* 2. CONTAS E BANCOS */}
                <div className="w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Carteiras e Bancos</h2>
                        <span className="text-xs px-3 py-1 rounded-full border bg-gray-100 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-400">
                            {accounts.length}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                        {accounts.map(acc => (
                            <div key={acc.id} onClick={() => handleEditGeneric(acc, 'ACCOUNT')} className="cursor-pointer rounded-2xl p-4 flex justify-between items-center shadow-sm hover:shadow-md bg-white border border-gray-100 dark:bg-[#1E293B] dark:border-slate-700/50 transition-all hover:scale-[1.01]">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className={`p-2.5 rounded-full shrink-0 ${acc.is_shared ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                                        <Wallet className={`w-5 h-5 ${acc.is_shared ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{acc.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {acc.is_shared ? (
                                                <><Users size={12} className="text-blue-500 dark:text-blue-400"/><p className="text-xs font-medium text-gray-500 dark:text-gray-500">Familiar</p></>
                                            ) : (
                                                <><Lock size={12} className="text-gray-400 dark:text-gray-500"/><p className="text-xs font-medium text-gray-500 dark:text-gray-500">Privada</p></>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className="font-bold text-gray-900 dark:text-gray-100 ml-2 whitespace-nowrap">
                                    R$ {Number(acc.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}
                        
                        {accounts.length === 0 && (
                            <p className="text-gray-500 text-sm py-4 col-span-full text-center">
                                Nenhuma conta cadastrada.
                            </p>
                        )}
                    </div>
                </div>

                {/* 3. CARTÕES DE CRÉDITO */}
                <div className="w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Cartões de Crédito</h2>
                        <span className="text-xs px-3 py-1 rounded-full border bg-gray-100 border-gray-200 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-400">
                            {cards.length}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
                        {cards.map(card => {
                               const avail = Number(card.limit_available);
                               const total = Number(card.limit_total);
                               const invoiceVal = card.invoice_info?.value || 0;
                               const invoiceStatus = card.invoice_info?.status || 'Sem Fatura';
                               const percentage = total === 0 ? 0 : Math.min(100, Math.max(0, (avail / total) * 100));
                               
                               return (
                                    <div key={card.id} className="rounded-2xl p-4 shadow-sm hover:shadow-md flex flex-col justify-between h-auto bg-white border border-gray-100 dark:bg-[#1E293B] dark:border-slate-700/50 transition-all">
                                        <div onClick={() => handleEditGeneric(card, 'CARD')} className="cursor-pointer flex justify-between items-start gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2.5 rounded-full shrink-0 bg-purple-50 dark:bg-purple-900/20">
                                                    <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{card.name}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5 mb-2">
                                                        {card.is_shared ? <Users size={12} className="text-blue-500"/> : <Lock size={12} className="text-gray-400"/>}
                                                        <p className="text-[10px] text-gray-500">{card.is_shared ? 'Familiar' : 'Privada'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 block whitespace-nowrap text-sm">
                                                    R$ {avail.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-[10px] text-gray-400 uppercase font-bold">Disponível</span>
                                            </div>
                                        </div>

                                        <div className="w-full mt-2 mb-3">
                                            <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-500" style={{ width: `${percentage}%` }} />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Fatura Atual</p>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border
                                                        ${invoiceStatus === 'Aberta' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 
                                                        invoiceStatus === 'Fechada' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                                        {invoiceStatus}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-rose-500">R$ {Number(invoiceVal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            
                                            {Number(invoiceVal) > 0 && invoiceStatus === 'Aberta' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenPayInvoice(card); }} className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">Pagar</button>
                                            )}
                                            {(Number(invoiceVal) === 0 || invoiceStatus === 'Paga') && (
                                                <div className="flex items-center gap-1 text-emerald-500"><CheckCircle size={14}/><span className="text-xs font-medium">Em dia</span></div>
                                            )}
                                        </div>
                                    </div>
                                );
                        })}
                        {cards.length === 0 && <p className="text-gray-500 text-sm py-4 col-span-full text-center">Nenhum cartão cadastrado.</p>}
                    </div>
                </div>

                {/* 4. CONTAS RECORRENTES */}
                <div className="w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Calendar size={20} className="text-teal-500"/> Contas Recorrentes (Mês)
                        </h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recurringBills.length === 0 ? (
                            <div className="col-span-full text-center py-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl text-gray-400 text-sm">
                                Nenhuma conta recorrente cadastrada.
                            </div>
                        ) : (
                            recurringBills.map(bill => {
                                const status = checkBillStatus(bill.id);
                                return (
                                    <div key={bill.id} className="rounded-2xl p-4 border transition-all flex justify-between items-center group hover:shadow-md bg-white border-gray-100 dark:bg-[#1E293B] dark:border-slate-700/50">
                                        <div onClick={() => handleEditGeneric(bill, 'RECURRING')} className="cursor-pointer flex-1 flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${status.paid ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'}`}>
                                                {status.paid ? <CheckCircle size={20} /> : <Circle size={20} />}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${status.paid ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {bill.name}
                                                </p>
                                                <p className="text-xs text-gray-500">Vence dia {bill.due_day}</p>
                                            </div>
                                        </div>
                                        {status.paid ? (
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">Pago</span>
                                        ) : (
                                            <button onClick={() => handleOpenPayModal(bill)} className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95">Pagar</button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 5. AÇÕES RÁPIDAS */}
                <div className="w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Plus size={20} className="text-teal-500"/> Ações Rápidas
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:gap-6 w-full">
                        <button onClick={() => handleNewTransaction('INCOME')} className="bg-emerald-600 rounded-3xl p-5 flex flex-col items-center justify-center space-y-3 shadow-lg hover:bg-emerald-500 transition active:scale-95 group w-full">
                            <div className="border-2 border-emerald-400 rounded-full p-1.5 group-hover:border-white transition"><ArrowUpCircle className="text-white w-6 h-6" /></div>
                            <span className="font-bold text-white text-sm">Nova Receita</span>
                        </button>
                        <button onClick={() => handleNewTransaction('EXPENSE')} className="bg-rose-600 rounded-3xl p-5 flex flex-col items-center justify-center space-y-3 shadow-lg hover:bg-rose-500 transition active:scale-95 group w-full">
                            <div className="border-2 border-rose-400 rounded-full p-1.5 group-hover:border-white transition"><ArrowDownCircle className="text-white w-6 h-6" /></div>
                            <span className="font-bold text-white text-sm">Nova Despesa</span>
                        </button>
                    </div>
                </div>

                {/* 6. MOVIMENTAÇÕES */}
                <div className="w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <DollarSign size={20} className="text-purple-500"/> Movimentações Recentes
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {recentTransactions.length === 0 ? (
                            <p className="text-center text-gray-500 text-sm py-4">Nenhuma movimentação recente.</p>
                        ) : (
                            recentTransactions.map(transaction => {
                                const isExpense = transaction.type === 'EXPENSE';
                                return (
                                    <div key={transaction.id} className="flex justify-between items-center p-3 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700/50 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${isExpense ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400'}`}>
                                                {isExpense ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate max-w-[150px] md:max-w-xs">{transaction.description}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {transaction.category_name || 'Geral'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`font-bold ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {isExpense ? '- ' : '+ '} R$ {Number(transaction.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </main>
        </div>
      </div>

      <button onClick={openModalNew} className="fixed bottom-24 md:bottom-10 right-4 md:right-10 p-4 rounded-full transition active:scale-90 z-50 text-white shadow-xl bg-teal-600 hover:bg-teal-500 shadow-teal-200 dark:bg-teal-500 dark:hover:bg-teal-400 dark:shadow-none">
        <Plus size={28} strokeWidth={2.5} />
      </button>

      <MobileMenu />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={
            modalView === 'MENU' ? "Adicionar Novo" : 
            modalView === 'ACCOUNT' ? (editingItem ? "Editar Conta" : "Nova Conta") : 
            modalView === 'CARD' ? (editingItem ? "Editar Cartão" : "Novo Cartão") :
            modalView === 'RECURRING' ? (editingItem ? "Editar Recorrência" : "Nova Recorrência") :
            modalView === 'NEW_TRANSACTION' ? (transactionType === 'INCOME' ? "Nova Receita" : "Nova Despesa") :
            modalView === 'CATEGORY_MANAGER' ? "Categorias" :
            modalView === 'PAY_INVOICE' ? "Pagar Fatura" :
            "Pagar Conta"
        }
      >
        {modalView === 'MENU' && (
            <div className="grid grid-cols-1 gap-3">
                <MenuOption icon={Wallet} label="Conta Corrente" desc="Carteira, Banco" onClick={() => setModalView('ACCOUNT')} color="teal" />
                <MenuOption icon={CreditCard} label="Cartão de Crédito" desc="Limites, Faturas" onClick={() => setModalView('CARD')} color="purple" />
                <MenuOption icon={Repeat} label="Conta Recorrente" desc="Aluguel, Internet" onClick={() => setModalView('RECURRING')} color="orange" />
            </div>
        )}

        {modalView === 'ACCOUNT' && <NewAccountForm initialData={editingItem} onBack={!editingItem ? () => setModalView('MENU') : null} onSuccess={() => { setIsModalOpen(false); loadDashboardData(); }} />}
        {modalView === 'CARD' && <NewCreditCardForm initialData={editingItem} onBack={!editingItem ? () => setModalView('MENU') : null} onSuccess={() => { setIsModalOpen(false); loadDashboardData(); }} />}
        {modalView === 'RECURRING' && <NewRecurringBillForm initialData={editingItem} onBack={!editingItem ? () => setModalView('MENU') : null} onManageCategories={() => setModalView('CATEGORY_MANAGER')} onSuccess={() => { setIsModalOpen(false); loadDashboardData(); }} />}
        {modalView === 'NEW_TRANSACTION' && <NewTransactionForm type={transactionType} accounts={accounts} cards={cards} onManageCategories={() => setModalView('CATEGORY_MANAGER')} onSuccess={() => { setIsModalOpen(false); loadDashboardData(); }} />}
        {modalView === 'CATEGORY_MANAGER' && <CategoryManager onBack={() => { if(transactionType) setModalView('NEW_TRANSACTION'); else setModalView('RECURRING'); }} />}

        {modalView === 'PAY_BILL' && billToPay && (
            <form onSubmit={confirmPayment} className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                    <p className="text-sm text-gray-500 mb-1">Pagando conta:</p>
                    <p className="font-bold text-lg text-gray-800 dark:text-white">{billToPay.name}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do Pagamento</label>
                    <MoneyInput value={paymentValue} onValueChange={setPaymentValue} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Debitar de</label>
                    <select className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} required>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance})</option>)}
                    </select>
                </div>
                <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-500 active:scale-95 transition">Confirmar Pagamento</button>
            </form>
        )}

        {modalView === 'PAY_INVOICE' && invoiceToPay && (
            <form onSubmit={confirmInvoicePayment} className="space-y-4">
                <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30">
                    <p className="text-sm text-rose-500 mb-1">Fatura do Cartão:</p>
                    <p className="font-bold text-lg text-gray-800 dark:text-white">{invoiceToPay.cardName}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor a Pagar</label>
                    <MoneyInput value={paymentValue} onValueChange={setPaymentValue} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Debitar de</label>
                    <select className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} required>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance})</option>)}
                    </select>
                </div>
                <button type="submit" className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl hover:bg-rose-500 active:scale-95 transition">Pagar Fatura</button>
            </form>
        )}
      </Modal>

    </div>
  );
}

function MenuOption({ icon: Icon, label, desc, onClick, color }) {
    const colors = {
        teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
        purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
        orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return (
        <button onClick={onClick} className="flex items-center justify-between p-4 rounded-xl border transition-all bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-white">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${colors[color]}`}>
                    <Icon size={24} />
                </div>
                <div className="text-left">
                    <p className="font-bold">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                </div>
            </div>
            <ChevronRight className="text-gray-400" />
        </button>
    );
}