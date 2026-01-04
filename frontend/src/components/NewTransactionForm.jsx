import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import { 
  Calendar, Tag, FileText, Wallet, CreditCard, 
  ArrowRight, CheckCircle2, AlertCircle, Hash, Plus, X 
} from 'lucide-react';

export default function NewTransactionForm({ type, accounts, cards, onSuccess, onManageCategories }) {
  const isExpense = type === 'EXPENSE';
  
  const [description, setDescription] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Controle de Pagamento (Multi ou Single)
  const [paymentsList, setPaymentsList] = useState([]);
  const [tempMethod, setTempMethod] = useState('ACCOUNT');
  const [tempSourceId, setTempSourceId] = useState('');
  const [tempAmount, setTempAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  
  const [loading, setLoading] = useState(false);

  // Carrega dados iniciais
  useEffect(() => {
    api.get('/categories/')
      .then(res => setCategories(res.data))
      .catch(err => console.error("Erro categorias", err));
  }, []);

  // Seleção automática padrão
  useEffect(() => {
    if (accounts.length > 0 && !tempSourceId && tempMethod === 'ACCOUNT') setTempSourceId(accounts[0].id);
    if (cards.length > 0 && !tempSourceId && tempMethod === 'CREDIT_CARD') setTempSourceId(cards[0].id);
  }, [accounts, cards, tempMethod]);

  const filteredCategories = categories.filter(cat => cat.type === type);

  // Cálculos de Restante
  const numericTotal = typeof totalValue === 'string' ? parseFloat(totalValue.replace(',', '.')) || 0 : totalValue;
  const totalPaid = paymentsList.reduce((acc, p) => acc + p.value, 0);
  const remaining = Math.max(0, numericTotal - totalPaid);

  // Adicionar Pagamento à Lista
  const handleAddPayment = () => {
    if (!tempSourceId) return toast.error("Selecione a origem.");
    
    let valToAdd = 0;
    // Se não digitou valor, assume o restante
    if (!tempAmount) valToAdd = remaining;
    else valToAdd = typeof tempAmount === 'string' ? parseFloat(tempAmount.replace(',', '.')) : tempAmount;

    if (valToAdd <= 0) return toast.error("Valor inválido.");
    if (valToAdd > remaining + 0.01) return toast.error("Valor excede o total.");

    const sourceName = tempMethod === 'ACCOUNT' 
        ? accounts.find(a => a.id == tempSourceId)?.name 
        : cards.find(c => c.id == tempSourceId)?.name;

    setPaymentsList([...paymentsList, {
        method: tempMethod,
        id: tempSourceId,
        name: sourceName,
        value: valToAdd,
        installments: tempMethod === 'CREDIT_CARD' ? installments : 1
    }]);
    
    setTempAmount(''); // Limpa para o próximo
    setInstallments(1);
  };

  const removePayment = (idx) => {
    setPaymentsList(paymentsList.filter((_, i) => i !== idx));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description || numericTotal <= 0) return toast.error("Preencha descrição e valor.");
    
    // Se for Despesa, valida pagamentos
    let finalPayments = paymentsList;
    
    // Se não adicionou nenhum na lista, tenta usar o que está selecionado nos inputs (modo simples)
    if (isExpense && paymentsList.length === 0) {
        if (!tempSourceId) return toast.error("Selecione uma conta/cartão.");
        finalPayments = [{
            method: tempMethod,
            id: tempSourceId,
            value: numericTotal,
            installments: tempMethod === 'CREDIT_CARD' ? installments : 1
        }];
    } else if (isExpense && remaining > 0.05) {
        return toast.error(`Falta alocar R$ ${remaining.toFixed(2)}`);
    }

    setLoading(true);
    try {
        const payload = {
            description,
            value: numericTotal,
            type: type,
            date: date,
            category: categoryId || null,
            payments: isExpense ? finalPayments : [], // Backend agora aceita lista
            // Fallback para Receita (Single)
            payment_method: !isExpense ? 'ACCOUNT' : undefined,
            account: !isExpense ? tempSourceId : undefined
        };

        await api.post('/transactions/', payload);
        toast.success("Lançamento realizado!");
        onSuccess(); 
    } catch (error) {
        console.error(error);
        const msg = error.response?.data?.error || "Erro ao salvar.";
        toast.error(msg);
    } finally {
        setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      
      {/* VALOR TOTAL */}
      <div>
        <label className={`block text-xs font-bold uppercase mb-1 ${isExpense ? 'text-rose-500' : 'text-emerald-500'}`}>
            Valor Total
        </label>
        <MoneyInput 
            value={totalValue} 
            onValueChange={setTotalValue} 
            placeholder="0,00" 
            autoFocus 
            className="text-3xl"
        />
      </div>

      {/* DESCRIÇÃO E DATA */}
      <div className="space-y-3">
        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Descrição</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><FileText size={18} /></div>
                <input type="text" placeholder={isExpense ? "Ex: Mercado..." : "Ex: Salário..."} className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <div className="flex items-center mb-1 h-5"><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Data</label></div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Calendar size={18} /></div>
                    <input type="date" className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium appearance-none h-[46px]" value={date} onChange={e => setDate(e.target.value)} />
                </div>
            </div>
            <div>
                <div className="flex justify-between items-center mb-1 h-5">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Categoria</label>
                    <button type="button" onClick={onManageCategories} className="bg-white dark:bg-[#1E293B] text-[10px] text-teal-600 font-bold hover:underline">Gerenciar</button>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Tag size={18} /></div>
                    <select className="w-full pl-10 pr-8 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium appearance-none h-[46px]" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                        <option value="">Sem categoria</option>
                        {filteredCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
                </div>
            </div>
        </div>
      </div>

      {/* --- PAGAMENTOS (SÓ PARA DESPESA) --- */}
      {isExpense && (
        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700/50 space-y-4">
            
            {/* LISTA DE PAGAMENTOS JÁ ADICIONADOS */}
            {paymentsList.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase">Pagamentos</p>
                    {paymentsList.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-full ${p.method === 'ACCOUNT' ? 'bg-teal-100 text-teal-600' : 'bg-purple-100 text-purple-600'}`}>
                                    {p.method === 'ACCOUNT' ? <Wallet size={14}/> : <CreditCard size={14}/>}
                                </div>
                                <div className="text-xs">
                                    <p className="font-bold text-gray-700 dark:text-gray-200">{p.name}</p>
                                    {p.installments > 1 && <p className="text-gray-400">{p.installments}x</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-800 dark:text-white">R$ {p.value.toFixed(2)}</span>
                                <button type="button" onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SELETOR (Só aparece se ainda faltar pagar) */}
            {remaining > 0.05 ? (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                            {paymentsList.length > 0 ? 'Adicionar Outro Pagamento' : 'Forma de Pagamento'}
                        </label>
                        {paymentsList.length > 0 && <span className="text-xs font-bold text-orange-500">Restam R$ {remaining.toFixed(2)}</span>}
                    </div>

                    <div className="space-y-3">
                        {/* TIPO */}
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setTempMethod('ACCOUNT')} className={`py-1.5 rounded text-xs font-bold border transition ${tempMethod === 'ACCOUNT' ? 'bg-teal-100 border-teal-300 text-teal-700' : 'bg-white border-gray-200 text-gray-500'}`}>Débito</button>
                            <button type="button" onClick={() => setTempMethod('CREDIT_CARD')} className={`py-1.5 rounded text-xs font-bold border transition ${tempMethod === 'CREDIT_CARD' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500'}`}>Crédito</button>
                        </div>

                        {/* CONTA/CARTÃO + PARCELAS */}
                        <div className="flex gap-2">
                            <select className="flex-1 p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm outline-none" value={tempSourceId} onChange={e => setTempSourceId(e.target.value)}>
                                {tempMethod === 'ACCOUNT' ? accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>) : cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {tempMethod === 'CREDIT_CARD' && (
                                <div className="w-20 relative">
                                    <span className="absolute left-2 top-2 text-xs font-bold text-gray-400">x</span>
                                    <input type="number" min="1" className="w-full pl-5 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-sm font-bold text-center outline-none" value={installments} onChange={e => setInstallments(e.target.value)}/>
                                </div>
                            )}
                        </div>

                        {/* VALOR + BOTÃO ADD */}
                        <div className="flex gap-2 items-center">
                            <div className="flex-1">
                                <MoneyInput value={tempAmount} onValueChange={setTempAmount} placeholder={remaining.toFixed(2)} className="text-sm bg-white" />
                            </div>
                            <button type="button" onClick={handleAddPayment} className="px-4 py-2 bg-gray-800 hover:bg-black text-white rounded-lg text-sm font-bold flex items-center gap-1">
                                <Plus size={16}/> Add
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg text-center text-xs font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 size={14}/> Total Coberto!
                </div>
            )}
        </div>
      )}

      {/* --- RECEITA (SIMPLIFICADO) --- */}
      {!isExpense && (
        <div className="relative">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Receber em</label>
            <select className="w-full p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none text-sm" value={tempSourceId} onChange={e => setTempSourceId(e.target.value)}>
                {accounts.length === 0 && <option>Nenhuma conta</option>}
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
            <div className="absolute right-3 top-9 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading || (isExpense && remaining > 0.05)}
        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg active:scale-95 transition flex items-center justify-center gap-2 ${isExpense ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'} ${(loading || (isExpense && remaining > 0.05)) ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Salvando...' : (isExpense ? 'Confirmar Despesa' : 'Confirmar Receita')}
      </button>
    </form>
  );
}