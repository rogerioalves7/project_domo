import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import { 
  Calendar, Tag, FileText, Wallet, CreditCard, 
  ArrowRight, CheckCircle2, AlertCircle, Hash 
} from 'lucide-react';

export default function NewTransactionForm({ type, accounts, cards, onSuccess, onManageCategories }) {
  // type pode ser 'INCOME' ou 'EXPENSE'
  
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Controle de Pagamento
  const [paymentMethod, setPaymentMethod] = useState('ACCOUNT'); // ACCOUNT ou CREDIT_CARD
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [installments, setInstallments] = useState(1);
  
  const [loading, setLoading] = useState(false);

  // 1. Carrega Categorias ao abrir
  useEffect(() => {
    api.get('/categories/')
      .then(res => setCategories(res.data))
      .catch(err => console.error("Erro ao carregar categorias", err));
  }, []);

  // 2. Seleciona conta/cartão padrão ao carregar
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) setSelectedAccount(accounts[0].id);
    if (cards.length > 0 && !selectedCard) setSelectedCard(cards[0].id);
  }, [accounts, cards]);

  // 3. Filtra as categorias pelo Tipo da Transação
  const filteredCategories = categories.filter(cat => cat.type === type);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description || !value) return toast.error("Descrição e Valor são obrigatórios");
    
    if (paymentMethod === 'ACCOUNT' && !selectedAccount) return toast.error("Selecione uma conta.");
    if (paymentMethod === 'CREDIT_CARD' && !selectedCard) return toast.error("Selecione um cartão.");

    setLoading(true);
    try {
        const numericVal = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        const finalInstallments = paymentMethod === 'CREDIT_CARD' ? (parseInt(installments) || 1) : 1;
        
        const payload = {
            description,
            value: numericVal,
            type: type,
            date: date,
            category: categoryId || null,
            payment_method: paymentMethod,
            installments: finalInstallments
        };

        if (paymentMethod === 'ACCOUNT') {
            payload.account = selectedAccount;
        } else {
            payload.card = selectedCard;
        }

        await api.post('/transactions/', payload);
        toast.success(type === 'EXPENSE' ? "Despesa lançada!" : "Receita lançada!");
        onSuccess(); 
    } catch (error) {
        console.error(error);
        const msg = error.response?.data?.error || "Erro ao salvar transação.";
        toast.error(msg);
    } finally {
        setLoading(false);
    }
  }

  const isExpense = type === 'EXPENSE';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      
      {/* --- CABEÇALHO DO VALOR --- */}
      <div>
        <label className={`block text-xs font-bold uppercase mb-1 ${isExpense ? 'text-rose-500' : 'text-emerald-500'}`}>
            Valor da {isExpense ? 'Despesa' : 'Receita'}
        </label>
        <MoneyInput 
            value={value} 
            onValueChange={setValue} 
            placeholder="0,00" 
            autoFocus 
            className="text-3xl"
        />
      </div>

      {/* --- DESCRIÇÃO E DATA --- */}
      <div className="space-y-3">
        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Descrição</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><FileText size={18} /></div>
                <input 
                    type="text" 
                    placeholder={isExpense ? "Ex: Mercado, Uber..." : "Ex: Salário, Freelance..."}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            {/* COLUNA DATA */}
            <div>
                {/* Altura fixa (h-5) na label para alinhar com a coluna da direita que tem botão */}
                <div className="flex items-center mb-1 h-5">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Data</label>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Calendar size={18} /></div>
                    <input 
                        type="date" 
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium appearance-none h-[46px]" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                    />
                </div>
            </div>
            
            {/* COLUNA CATEGORIA */}
            <div>
                {/* Altura fixa (h-5) na label para garantir alinhamento perfeito */}
                <div className="flex justify-between items-center mb-1 h-5">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Categoria</label>
                    <button type="button" onClick={onManageCategories} className="text-[10px] text-teal-600 font-bold hover:underline">Gerenciar</button>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Tag size={18} /></div>
                    <select 
                        className="w-full pl-10 pr-8 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium appearance-none h-[46px]" 
                        value={categoryId} 
                        onChange={e => setCategoryId(e.target.value)}
                    >
                        <option value="">Sem categoria</option>
                        {filteredCategories.length === 0 && (
                            <option disabled>Nenhuma categoria disponível</option>
                        )}
                        {filteredCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
                </div>
            </div>
        </div>
      </div>

      {/* --- SELETOR DE PAGAMENTO (SÓ PARA DESPESA) --- */}
      {isExpense && (
        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700/50">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Forma de Pagamento</label>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
                <button 
                    type="button" 
                    onClick={() => setPaymentMethod('ACCOUNT')} 
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${paymentMethod === 'ACCOUNT' ? 'bg-white dark:bg-slate-800 border-teal-500 text-teal-600 shadow-sm' : 'border-transparent text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                    <Wallet size={18} /> <span className="text-xs font-bold">Débito / Pix</span>
                </button>
                <button 
                    type="button" 
                    onClick={() => setPaymentMethod('CREDIT_CARD')} 
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${paymentMethod === 'CREDIT_CARD' ? 'bg-white dark:bg-slate-800 border-purple-500 text-purple-600 shadow-sm' : 'border-transparent text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                    <CreditCard size={18} /> <span className="text-xs font-bold">Crédito</span>
                </button>
            </div>

            {paymentMethod === 'ACCOUNT' ? (
                <div className="relative">
                    <select 
                        className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 appearance-none text-sm"
                        value={selectedAccount}
                        onChange={e => setSelectedAccount(e.target.value)}
                    >
                        {accounts.length === 0 && <option>Nenhuma conta cadastrada</option>}
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} (R$ {Number(acc.balance).toFixed(2)})</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 relative">
                        <select 
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-purple-500 appearance-none text-sm"
                            value={selectedCard}
                            onChange={e => setSelectedCard(e.target.value)}
                        >
                            {cards.length === 0 && <option>Nenhum cartão</option>}
                            {cards.map(c => (
                                <option key={c.id} value={c.id}>{c.name} (Disp: R$ {Number(c.limit_available).toFixed(2)})</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
                    </div>
                    
                    {/* INPUT NUMÉRICO PARA PARCELAS */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <span className="text-xs font-bold">x</span>
                        </div>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            className="w-full pl-7 pr-2 py-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium text-center"
                            placeholder="1"
                            value={installments}
                            onChange={e => setInstallments(Math.max(1, parseInt(e.target.value) || ''))}
                        />
                    </div>
                </div>
            )}
        </div>
      )}

      {/* --- SELETOR DE CONTA PARA RECEITA --- */}
      {!isExpense && (
        <div className="relative">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Receber em</label>
            <select 
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none text-sm"
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
            >
                {accounts.length === 0 && <option>Nenhuma conta cadastrada</option>}
                {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
            </select>
            <div className="absolute right-3 top-9 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading}
        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg active:scale-95 transition flex items-center justify-center gap-2 ${isExpense ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Salvando...' : (isExpense ? 'Confirmar Despesa' : 'Confirmar Receita')}
      </button>
    </form>
  );
}