import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import MoneyInput from './MoneyInput';
import { Trash2, Save } from 'lucide-react';

export default function NewRecurringBillForm({ initialData, onBack, onSuccess, onManageCategories }) {
  const [name, setName] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    loadCategories();
    // Se vier dados iniciais, é EDIÇÃO
    if (initialData) {
      setName(initialData.name);
      setBaseValue(initialData.base_value);
      setDueDay(initialData.due_day);
      setCategory(initialData.category);
    }
  }, [initialData]);

  async function loadCategories() {
    try {
      const response = await api.get('/categories/?type=EXPENSE');
      setCategories(response.data);
    } catch (error) {
      console.error("Erro ao carregar categorias", error);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Tratamento do valor (R$ 1.000,00 -> 1000.00)
    const formattedValue = typeof baseValue === 'string' 
      ? parseFloat(baseValue.replace('.', '').replace(',', '.')) 
      : baseValue;

    const payload = {
      name,
      base_value: formattedValue,
      due_day: parseInt(dueDay),
      category
    };

    try {
      if (initialData) {
        // EDIÇÃO (PUT)
        await api.put(`/recurring-bills/${initialData.id}/`, payload);
        toast.success("Conta fixa atualizada!");
      } else {
        // CRIAÇÃO (POST)
        await api.post('/recurring-bills/', payload);
        toast.success("Conta fixa criada!");
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "Erro ao salvar.");
    }
  }

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja excluir esta conta fixa? O histórico de pagamentos passados será mantido.")) return;

    try {
      await api.delete(`/recurring-bills/${initialData.id}/`);
      toast.success("Conta fixa removida!");
      onSuccess();
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:underline mb-2">
          &larr; Voltar
        </button>
      )}
      
      <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 mb-4">
        <h3 className="font-bold text-orange-700 dark:text-orange-400">
          {initialData ? `Editar: ${initialData.name}` : 'Nova Conta Fixa'}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Isso serve para prever seus gastos mensais automaticamente.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome da Conta</label>
        <input 
          type="text" 
          placeholder="Ex: Aluguel, Netflix, Internet"
          className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Base (R$)</label>
          <MoneyInput value={baseValue} onValueChange={setBaseValue} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dia Vencimento</label>
          <input 
            type="number" 
            min="1" max="31"
            placeholder="Ex: 10"
            className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
            value={dueDay}
            onChange={e => setDueDay(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold text-gray-500 uppercase">Categoria</label>
            <button type="button" onClick={onManageCategories} className="text-[10px] text-teal-600 font-bold hover:underline">Gerenciar</button>
        </div>
        <select 
          className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
          value={category}
          onChange={e => setCategory(e.target.value)}
          required
        >
          <option value="">Selecione...</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="pt-2 flex gap-3">
        {initialData && (
          <button 
            type="button" 
            onClick={handleDelete}
            className="flex-1 bg-red-100 text-red-600 font-bold py-3 rounded-xl hover:bg-red-200 transition flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> Excluir
          </button>
        )}
        <button 
          type="submit" 
          className="flex-[2] bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-500 transition flex items-center justify-center gap-2"
        >
          <Save size={18} /> {initialData ? 'Salvar Alterações' : 'Criar Conta'}
        </button>
      </div>
    </form>
  );
}