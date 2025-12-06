import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import Input from './Input';
import { FileText, Calendar, Tag, Wallet, ArrowLeft, Plus, CreditCard, Layers } from 'lucide-react';

export default function NewTransactionForm({ type, onSuccess, onBack, onManageCategories, accounts, cards }) {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  
  // Novos Estados
  const [paymentMethod, setPaymentMethod] = useState('ACCOUNT'); // 'ACCOUNT' ou 'CREDIT_CARD'
  const [selectedId, setSelectedId] = useState(''); // ID da Conta ou do Cartão
  const [installments, setInstallments] = useState(1);
  
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(false);

  const isExpense = type === 'EXPENSE';

  useEffect(() => {
    async function loadData() {
        try {
            const response = await api.get('/categories/');
            const filtered = response.data.filter(cat => cat.type === type);
            setCategoriesList(filtered);
            
            // Auto-seleção inicial
            if (paymentMethod === 'ACCOUNT' && accounts.length > 0) setSelectedId(accounts[0].id);
            if (paymentMethod === 'CREDIT_CARD' && cards.length > 0) setSelectedId(cards[0].id);

        } catch (e) {
            console.error("Erro ao carregar dados", e);
        }
    }
    loadData();
  }, [type, accounts, cards]);

  // Reseta o ID selecionado quando troca o método
  useEffect(() => {
      if (paymentMethod === 'ACCOUNT' && accounts.length > 0) setSelectedId(accounts[0].id);
      else if (paymentMethod === 'CREDIT_CARD' && cards.length > 0) setSelectedId(cards[0].id);
      else setSelectedId('');
  }, [paymentMethod, accounts, cards]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedId) return toast.error("Selecione uma forma de pagamento.");
    
    setLoading(true);

    try {
      const finalValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

      const payload = {
        description,
        value: finalValue,
        type: type,
        date: date,
        category: category ? parseInt(category) : null,
        // Campos Dinâmicos
        payment_method: paymentMethod,
        installments: parseInt(installments)
      };

      if (paymentMethod === 'ACCOUNT') {
          payload.account = parseInt(selectedId);
      } else {
          payload.card_id = parseInt(selectedId); // O Backend espera 'card_id' na nossa lógica customizada
      }

      await api.post('/transactions/', payload);

      toast.success(isExpense ? "Despesa lançada!" : "Receita recebida!");
      onSuccess();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao lançar transação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      <div className="flex items-center mb-2">
         {onBack && (
            <button type="button" onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
         )}
         <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${isExpense ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isExpense ? 'Nova Despesa' : 'Nova Receita'}
         </span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
        <Input 
            type="text" 
            required 
            placeholder={isExpense ? "Ex: Supermercado..." : "Ex: Salário..."}
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            icon={FileText} 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor</label>
            <MoneyInput value={value} onValueChange={setValue} />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
            <Input type="date" required value={date} onChange={e => setDate(e.target.value)} icon={Calendar} />
        </div>
      </div>

      {/* SELEÇÃO DE MÉTODO (Só aparece para Despesa) */}
      {isExpense && (
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPaymentMethod('ACCOUNT')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2
                    ${paymentMethod === 'ACCOUNT' ? 'bg-white dark:bg-slate-600 shadow text-teal-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
              >
                  <Wallet size={16}/> Débito / Conta
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2
                    ${paymentMethod === 'CREDIT_CARD' ? 'bg-white dark:bg-slate-600 shadow text-purple-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
              >
                  <CreditCard size={16}/> Cartão Crédito
              </button>
          </div>
      )}

      {/* SELEÇÃO DA ORIGEM (Dinâmica baseada no método) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {paymentMethod === 'ACCOUNT' ? 'Debitar da Conta' : 'Faturar no Cartão'}
        </label>
        <div className="relative">
            {paymentMethod === 'ACCOUNT' ? (
                <Wallet className="absolute left-3 top-3.5 text-gray-400 pointer-events-none z-10" size={20} />
            ) : (
                <CreditCard className="absolute left-3 top-3.5 text-purple-500 pointer-events-none z-10" size={20} />
            )}
            
            <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl appearance-none bg-white border border-gray-200 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
                <option value="" disabled>Selecione...</option>
                {paymentMethod === 'ACCOUNT' 
                    ? accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance})</option>)
                    : cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)
                }
            </select>
        </div>
      </div>

      {/* PARCELAS (Só aparece se for Cartão) */}
      {paymentMethod === 'CREDIT_CARD' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parcelas</label>
            <Input 
                type="number" 
                min="1" 
                max="48"
                value={installments} 
                onChange={e => setInstallments(e.target.value)} 
                icon={Layers} 
            />
          </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
        <div className="flex gap-2">
            <div className="relative flex-1">
                <Tag className="absolute left-3 top-3.5 text-gray-400 pointer-events-none z-10" size={20} />
                <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl appearance-none bg-white border border-gray-200 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="">Sem categoria</option>
                    {categoriesList.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <button 
                type="button"
                onClick={onManageCategories}
                className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 p-3 rounded-xl transition border border-gray-200 dark:border-slate-700"
            >
                <Plus size={24} />
            </button>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading} 
        className={`w-full text-white font-bold py-3 rounded-xl active:scale-95 transition disabled:opacity-50 
            ${isExpense ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
      >
        {loading ? 'Salvando...' : (isExpense ? 'Confirmar Despesa' : 'Confirmar Receita')}
      </button>

    </form>
  );
}