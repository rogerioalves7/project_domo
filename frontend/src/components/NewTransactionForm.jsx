import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import { 
  Calendar, CreditCard, Wallet, Tag, FileText, 
  Repeat, CheckCircle2, AlertCircle, ArrowRight 
} from 'lucide-react';

export default function NewTransactionForm({ type, accounts, cards, onSuccess, onManageCategories }) {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Por padrão, se for Despesa, tenta usar Cartão se não houver contas
  const [paymentMethod, setPaymentMethod] = useState(type === 'EXPENSE' ? 'ACCOUNT' : 'ACCOUNT');
  
  // ID da Conta ou do Cartão selecionado
  const [selectedPaymentId, setSelectedPaymentId] = useState(''); 
  
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [loading, setLoading] = useState(false);

  // Carrega categorias ao abrir
  useEffect(() => {
    api.get('/categories/')
      .then(res => setCategories(res.data))
      .catch(err => console.error("Erro ao carregar categorias", err));
  }, []);

  // Seleciona automaticamente a primeira opção disponível
  useEffect(() => {
    if (paymentMethod === 'ACCOUNT' && accounts.length > 0) {
        setSelectedPaymentId(accounts[0].id);
    } else if (paymentMethod === 'CREDIT_CARD' && cards.length > 0) {
        setSelectedPaymentId(cards[0].id);
    } else {
        setSelectedPaymentId('');
    }
  }, [paymentMethod, accounts, cards]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!description || !value || !selectedPaymentId || !date) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      // Converte valor "R$ 1.200,50" para float 1200.50
      const numericValue = typeof value === 'string' 
        ? parseFloat(value.replace(/\./g, '').replace(',', '.')) 
        : value;

      const payload = {
        description,
        value: numericValue,
        type, // 'INCOME' ou 'EXPENSE'
        date,
        category: categoryId || null,
      };

      // --- MUDANÇA PRINCIPAL AQUI ---
      if (paymentMethod === 'CREDIT_CARD' && type === 'EXPENSE') {
        payload.payment_method = 'CREDIT_CARD';
        payload.card = selectedPaymentId; // Envia o ID do Cartão direto!
        // O Backend agora calcula a fatura (invoice) sozinho baseada na data.
        
        if (installments > 1) {
            payload.installments = installments;
        }
      } else {
        payload.payment_method = 'ACCOUNT';
        payload.account = selectedPaymentId;
      }

      // Lógica de Recorrência (Opcional, se você implementou)
      if (isRecurring) {
        payload.is_recurring = true;
      }

      await api.post('/transactions/', payload);
      
      toast.success("Lançamento realizado!");
      onSuccess(); // Fecha o modal e recarrega o dashboard
      
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || "Erro ao salvar transação.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      
      {/* 1. Valor e Descrição */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Valor
          </label>
          <MoneyInput 
            value={value} 
            onValueChange={setValue} 
            placeholder="0,00"
            autoFocus 
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
            Descrição
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <FileText size={18} />
            </div>
            <input 
              type="text" 
              placeholder={type === 'EXPENSE' ? "Ex: Supermercado" : "Ex: Salário"}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all text-sm font-medium"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. Data e Categoria */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          {/* Forçamos h-6 para alinhar com o label da categoria que tem botão */}
          <div className="flex justify-between items-center mb-1 h-6">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
              Data
            </label>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Calendar size={18} />
            </div>
            <input 
              type="date" 
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all text-sm font-medium h-[46px]" // h-[46px] garante altura igual
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          {/* Container do label com altura fixa h-6 */}
          <div className="flex justify-between items-center mb-1 h-6">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                Categoria
            </label>
            <button type="button" onClick={onManageCategories} className="text-[10px] text-teal-600 font-bold hover:underline">
                Gerenciar
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Tag size={18} />
            </div>
            <select 
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all text-sm font-medium appearance-none h-[46px]" // h-[46px] garante altura igual
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">Sem categoria</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Forma de Pagamento (Só exibe Cartão se for Despesa) */}
      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
            {type === 'EXPENSE' ? 'Pagar com' : 'Receber em'}
        </label>
        
        {type === 'EXPENSE' && (
            <div className="grid grid-cols-2 gap-3 mb-3">
                <button 
                    type="button"
                    onClick={() => setPaymentMethod('ACCOUNT')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                        paymentMethod === 'ACCOUNT' 
                        ? 'bg-teal-50 border-teal-500 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400' 
                        : 'bg-white border-gray-200 text-gray-500 dark:bg-slate-900 dark:border-slate-700'
                    }`}
                >
                    <Wallet size={18} />
                    <span className="font-bold text-sm">Conta</span>
                    {paymentMethod === 'ACCOUNT' && <CheckCircle2 size={16} className="text-teal-500 ml-1"/>}
                </button>

                <button 
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                        paymentMethod === 'CREDIT_CARD' 
                        ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' 
                        : 'bg-white border-gray-200 text-gray-500 dark:bg-slate-900 dark:border-slate-700'
                    }`}
                >
                    <CreditCard size={18} />
                    <span className="font-bold text-sm">Cartão</span>
                    {paymentMethod === 'CREDIT_CARD' && <CheckCircle2 size={16} className="text-purple-500 ml-1"/>}
                </button>
            </div>
        )}

        {/* Select dinâmico (Conta ou Cartão) */}
        <div className="relative">
            <select 
                className={`w-full p-3 rounded-xl bg-white dark:bg-slate-900 border text-gray-800 dark:text-white outline-none focus:ring-2 transition-all appearance-none ${
                    paymentMethod === 'ACCOUNT' 
                    ? 'border-gray-200 dark:border-slate-700 focus:ring-teal-500' 
                    : 'border-gray-200 dark:border-slate-700 focus:ring-purple-500'
                }`}
                value={selectedPaymentId}
                onChange={e => setSelectedPaymentId(e.target.value)}
            >
                {paymentMethod === 'ACCOUNT' ? (
                    accounts.length > 0 ? (
                        accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.name} (R$ {Number(acc.balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})})
                            </option>
                        ))
                    ) : <option value="">Nenhuma conta cadastrada</option>
                ) : (
                    cards.length > 0 ? (
                        cards.map(card => (
                            <option key={card.id} value={card.id}>
                                {card.name} (Disp: R$ {Number(card.limit_available).toLocaleString('pt-BR', {minimumFractionDigits: 2})})
                            </option>
                        ))
                    ) : <option value="">Nenhum cartão cadastrado</option>
                )}
            </select>
            <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                <ArrowRight size={16} className="rotate-90" />
            </div>
        </div>
      </div>

      {/* 4. Parcelamento (Apenas Cartão) */}
      {paymentMethod === 'CREDIT_CARD' && type === 'EXPENSE' && (
        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Parcelas
            </label>
            <div className="flex items-center gap-3">
                <input 
                    type="range" min="1" max="12" step="1"
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-purple-600"
                    value={installments}
                    onChange={e => setInstallments(Number(e.target.value))}
                />
                <span className="font-bold text-purple-600 dark:text-purple-400 w-12 text-center">
                    {installments}x
                </span>
            </div>
            
            {/* CORREÇÃO AQUI: Cálculo e Formatação da Parcela */}
            {installments > 1 && value && (
                <p className="text-xs text-center text-gray-400 mt-1">
                    {installments}x de R$ {(() => {
                        // 1. Converte o valor do input (ex: "1.200,00") para número (1200.00)
                        const numericValue = typeof value === 'string' 
                            ? parseFloat(value.replace(/\./g, '').replace(',', '.')) 
                            : value;
                        
                        // 2. Calcula a parcela
                        const installmentValue = numericValue / installments;

                        // 3. Formata como moeda BRL fixa em 2 casas
                        return installmentValue.toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                        });
                    })()}
                </p>
            )}
        </div>
      )}

      {/* Botão Salvar */}
      <button 
        type="submit" 
        disabled={loading}
        className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-white ${
            type === 'EXPENSE' 
            ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' 
            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
        }`}
      >
        {loading ? 'Salvando...' : (type === 'EXPENSE' ? 'Confirmar Despesa' : 'Confirmar Receita')}
      </button>

    </form>
  );
}