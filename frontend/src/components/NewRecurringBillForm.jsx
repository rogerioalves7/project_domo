import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import { Calendar, Tag, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

export default function NewRecurringBillForm({ initialData, onBack, onSuccess, onManageCategories }) {
  const [name, setName] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [dueDay, setDueDay] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Carrega Categorias
  useEffect(() => {
    api.get('/categories/')
      .then(res => setCategories(res.data))
      .catch(err => console.error("Erro categorias", err));
  }, []);

  // CORREÇÃO DA EDIÇÃO: Preenche os campos corretamente
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      // Converte para string para o MoneyInput entender
      setBaseValue(String(initialData.base_value)); 
      setDueDay(initialData.due_day);
      setCategoryId(initialData.category || '');
    }
  }, [initialData]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !baseValue) return toast.error("Nome e Valor obrigatórios");

    setLoading(true);
    try {
        const numericVal = typeof baseValue === 'string' ? parseFloat(baseValue.replace(',', '.')) : baseValue;
        const payload = { 
            name, 
            base_value: numericVal, 
            due_day: dueDay, 
            category: categoryId || null 
        };

        if (initialData) {
            await api.put(`/recurring-bills/${initialData.id}/`, payload);
            toast.success("Atualizado!");
        } else {
            await api.post('/recurring-bills/', payload);
            toast.success("Criado!");
        }
        onSuccess();
    } catch (error) {
        console.error(error);
        toast.error("Erro ao salvar.");
    } finally {
        setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nome</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><FileText size={18} /></div>
                <input type="text" placeholder="Ex: Aluguel" className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
        </div>
        <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Valor Base</label>
            <MoneyInput value={baseValue} onValueChange={setBaseValue} placeholder="0,00" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
            <div className="flex justify-between items-center mb-1 h-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Dia Venc.</label>
            </div>
            <div className="relative h-[46px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Calendar size={18} /></div>
                <select className="w-full h-full pl-10 pr-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white text-sm font-medium appearance-none" value={dueDay} onChange={e => setDueDay(Number(e.target.value))}>
                    {[...Array(31)].map((_, i) => (<option key={i+1} value={i+1}>{i+1}</option>))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ArrowRight size={14} className="rotate-90" /></div>
            </div>
        </div>
        <div>
            <div className="flex justify-between items-center mb-1 h-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Categoria</label>
                <button type="button" onClick={onManageCategories} className="bg-white dark:bg-[#1E293B] text-[10px] text-teal-600 font-bold hover:underline">Gerenciar</button>
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

      <div className="grid grid-cols-2 gap-3 pt-2">
        {onBack && <button type="button" onClick={onBack} className="w-full py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800 font-bold transition">Voltar</button>}
        <button type="submit" disabled={loading} className={`w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl hover:bg-orange-500 active:scale-95 transition shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 ${!onBack ? 'col-span-2' : ''} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {loading ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Criar Recorrência')}
        </button>
      </div>
    </form>
  );
}