import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import { 
  Calendar, CreditCard, Wallet, Tag, FileText, 
  CheckCircle2, ArrowRight 
} from 'lucide-react';

export default function NewTransactionForm({ type, accounts, cards, onSuccess, onManageCategories }) {
  const queryClient = useQueryClient();

  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(type === 'EXPENSE' ? 'ACCOUNT' : 'ACCOUNT');
  const [selectedPaymentId, setSelectedPaymentId] = useState(''); 
  const [categoryId, setCategoryId] = useState('');
  const [installments, setInstallments] = useState(1);
  
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories/').then(res => res.data),
  });

  useEffect(() => {
    if (paymentMethod === 'ACCOUNT') {
       if (accounts.length > 0) setSelectedPaymentId(accounts[0].id);
       else setSelectedPaymentId('');
    } else if (paymentMethod === 'CREDIT_CARD') {
       if (cards.length > 0) setSelectedPaymentId(cards[0].id);
       else setSelectedPaymentId('');
    }
  }, [paymentMethod, accounts, cards]);

  const mutation = useMutation({
    mutationFn: (newTransaction) => api.post('/transactions/', newTransaction),
    
    // --- NOVO: Configuração de Retry ---
    // Se o servidor der erro 500 (DNS, Banco fora), tenta 3 vezes antes de desistir.
    // Se o navegador estiver OFFLINE, nem conta tentativa (fica pausado).
    retry: 3,
    retryDelay: 1000, // Espera 1s entre tentativas

    onMutate: async (newTransaction) => {
      await queryClient.cancelQueries({ queryKey: ['transactions'] });
      await queryClient.cancelQueries({ queryKey: ['accounts'] });
      await queryClient.cancelQueries({ queryKey: ['credit-cards'] });

      const previousTransactions = queryClient.getQueryData(['transactions']);
      const previousAccounts = queryClient.getQueryData(['accounts']);
      const previousCards = queryClient.getQueryData(['credit-cards']);

      // 1. Atualiza Lista
      queryClient.setQueryData(['transactions'], (old) => {
        const optimisticTx = {
            ...newTransaction,
            id: 'temp-' + Math.random(),
            category_name: categories.find(c => c.id == newTransaction.category)?.name || 'Geral',
            source_name: 'Fila de Envio...', // Feedback visual
            owner_name: 'Você',
            created_at: new Date().toISOString()
        };
        return [optimisticTx, ...(old || [])];
      });

      // 2. Atualiza Saldo Conta
      if (newTransaction.payment_method === 'ACCOUNT' && newTransaction.type === 'EXPENSE') {
        queryClient.setQueryData(['accounts'], (oldAccounts) => {
            return oldAccounts?.map(acc => {
                if (acc.id === newTransaction.account) {
                    return { ...acc, balance: Number(acc.balance) - Number(newTransaction.value) };
                }
                return acc;
            });
        });
      }
      
      // 3. Atualiza Cartão
      if (newTransaction.payment_method === 'CREDIT_CARD' && newTransaction.type === 'EXPENSE') {
         queryClient.setQueryData(['credit-cards'], (oldCards) => {
            return oldCards?.map(card => {
                if (card.id === newTransaction.card) {
                    return { ...card, limit_available: Number(card.limit_available) - Number(newTransaction.value) };
                }
                return card;
            });
         });
      }

      onSuccess(); 
      toast.success("Salvo! (Sincronizando em 2º plano)");

      return { previousTransactions, previousAccounts, previousCards };
    },

    onError: (err, newTransaction, context) => {
      // Só faz rollback se esgotar todas as tentativas (retry: 3)
      queryClient.setQueryData(['transactions'], context.previousTransactions);
      queryClient.setQueryData(['accounts'], context.previousAccounts);
      queryClient.setQueryData(['credit-cards'], context.previousCards);
      toast.error("Falha definitiva. Tente novamente.");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
    },
  });

  async function handleSubmit(e) {
    e.preventDefault();
    // NÃO travamos mais o clique se estiver "isPending", pois pending agora pode significar "Pausado/Offline"
    // Travamos apenas se estiver carregando categorias ou algo bloqueante
    
    if (!description || !value || !selectedPaymentId || !date) {
      toast.error("Preencha todos os campos.");
      return;
    }

    const numericValue = typeof value === 'string' 
        ? parseFloat(value.replace(/\./g, '').replace(',', '.')) 
        : value;

    const payload = {
        description,
        value: numericValue,
        type,
        date,
        category: categoryId || null,
    };

    if (paymentMethod === 'CREDIT_CARD' && type === 'EXPENSE') {
        payload.payment_method = 'CREDIT_CARD';
        payload.card = selectedPaymentId;
        if (installments > 1) payload.installments = installments;
    } else {
        payload.payment_method = 'ACCOUNT';
        payload.account = selectedPaymentId;
    }

    mutation.mutate(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 1. Valor e Descrição */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor</label>
          <MoneyInput value={value} onValueChange={setValue} placeholder="0,00" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Descrição</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><FileText size={18} /></div>
            <input type="text" placeholder={type === 'EXPENSE' ? "Ex: Mercado" : "Ex: Salário"} className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 2. Data e Categoria */}
      <div className="grid grid-cols-2 gap-4">
        <div>
            <div className="flex justify-between items-center mb-1 h-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Data</label>
            </div>
            <div className="relative h-[46px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Calendar size={18} /></div>
                <input type="date" className="w-full h-full pl-10 pr-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium" value={date} onChange={e => setDate(e.target.value)} />
            </div>
        </div>
        <div>
            <div className="flex justify-between items-center mb-1 h-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Categoria</label>
                <button type="button" onClick={onManageCategories} className="text-[10px] text-teal-600 font-bold hover:underline">Gerenciar</button>
            </div>
            <div className="relative h-[46px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Tag size={18} /></div>
                <select className="w-full h-full pl-10 pr-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium appearance-none" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">Sem categoria</option>
                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
            </div>
        </div>
      </div>

      {/* 3. Forma de Pagamento */}
      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">{type === 'EXPENSE' ? 'Pagar com' : 'Receber em'}</label>
        {type === 'EXPENSE' && (
            <div className="grid grid-cols-2 gap-3 mb-3">
                <button type="button" onClick={() => setPaymentMethod('ACCOUNT')} className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${paymentMethod === 'ACCOUNT' ? 'bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400' : 'bg-white border-gray-200 text-gray-500 dark:bg-slate-900 dark:border-slate-700'}`}><Wallet size={18} /><span className="font-bold text-sm">Conta</span>{paymentMethod === 'ACCOUNT' && <CheckCircle2 size={16} className="text-teal-500 ml-1"/>}</button>
                <button type="button" onClick={() => setPaymentMethod('CREDIT_CARD')} className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${paymentMethod === 'CREDIT_CARD' ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' : 'bg-white border-gray-200 text-gray-500 dark:bg-slate-900 dark:border-slate-700'}`}><CreditCard size={18} /><span className="font-bold text-sm">Cartão</span>{paymentMethod === 'CREDIT_CARD' && <CheckCircle2 size={16} className="text-purple-500 ml-1"/>}</button>
            </div>
        )}
        <div className="relative">
            <select className={`w-full p-3 rounded-xl bg-white dark:bg-slate-900 border text-gray-800 dark:text-white outline-none focus:ring-2 transition-all appearance-none ${paymentMethod === 'ACCOUNT' ? 'border-gray-200 dark:border-slate-700 focus:ring-teal-500' : 'border-gray-200 dark:border-slate-700 focus:ring-purple-500'}`} value={selectedPaymentId} onChange={e => setSelectedPaymentId(e.target.value)}>
                {paymentMethod === 'ACCOUNT' ? (accounts.length > 0 ? accounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} (R$ {Number(acc.balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})})</option>)) : <option value="">Nenhuma conta</option>) : (cards.length > 0 ? cards.map(card => (<option key={card.id} value={card.id}>{card.name} (Disp: R$ {Number(card.limit_available).toLocaleString('pt-BR', {minimumFractionDigits: 2})})</option>)) : <option value="">Nenhum cartão</option>)}
            </select>
            <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400"><ArrowRight size={16} className="rotate-90" /></div>
        </div>
      </div>

      {/* 4. Parcelamento */}
      {paymentMethod === 'CREDIT_CARD' && type === 'EXPENSE' && (
        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Parcelas</label>
            <div className="flex items-center gap-3">
                <input type="range" min="1" max="12" step="1" className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-purple-600" value={installments} onChange={e => setInstallments(Number(e.target.value))} />
                <span className="font-bold text-purple-600 dark:text-purple-400 w-12 text-center">{installments}x</span>
            </div>
            {installments > 1 && value && (<p className="text-xs text-center text-gray-400 mt-1">{installments}x de R$ {(() => { const numericValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value; return (numericValue / installments).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); })()}</p>)}
        </div>
      )}

      <button 
        type="submit" 
        // Removemos o 'disabled={loading}' aqui para permitir múltiplos cliques se necessário (ou tratamos na lógica)
        // Mas o ideal é só mostrar 'Sincronizando' se for a primeira vez
        className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-white ${type === 'EXPENSE' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'}`}
      >
        {type === 'EXPENSE' ? 'Confirmar Despesa' : 'Confirmar Receita'}
      </button>
    </form>
  );
}