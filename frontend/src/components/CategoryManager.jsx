import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Input from './Input';
import { Tag, Plus, Trash2, Edit2, ArrowLeft, Check, X } from 'lucide-react';

export default function CategoryManager({ onBack }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para criação
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('EXPENSE');

  // Estado para edição
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const response = await api.get('/categories/');
      setCategories(response.data);
    } catch (error) {
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName) return;
    try {
      await api.post('/categories/', { name: newName, type: newType });
      toast.success("Categoria criada!");
      setNewName('');
      fetchCategories();
    } catch (error) {
      toast.error("Erro ao criar.");
    }
  }

  async function handleDelete(id) {
    if(!confirm("Excluir categoria? Itens vinculados perderão a categoria.")) return;
    try {
      await api.delete(`/categories/${id}/`);
      toast.success("Excluída.");
      fetchCategories();
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  }

  async function startEdit(cat) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function saveEdit(id) {
    try {
        await api.patch(`/categories/${id}/`, { name: editName });
        setEditingId(null);
        fetchCategories();
        toast.success("Editado!");
    } catch (error) {
        toast.error("Erro ao editar.");
    }
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center mb-4">
            <button 
                onClick={onBack}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h3 className="ml-auto font-bold text-gray-700 dark:text-gray-200">Gerenciar Categorias</h3>
        </div>

        {/* Form de Criação */}
        <form onSubmit={handleCreate} className="flex gap-2 items-end bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="flex-1">
                <label className="text-xs text-gray-500 ml-1">Nova Categoria</label>
                <Input 
                    placeholder="Ex: Mercado, Uber..." 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    icon={Tag}
                />
            </div>
            <div className="w-1/3">
                 <label className="text-xs text-gray-500 ml-1">Tipo</label>
                 <select 
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 h-[50px]"
                 >
                     <option value="EXPENSE">Despesa</option>
                     <option value="INCOME">Receita</option>
                 </select>
            </div>
            <button type="submit" className="h-[50px] w-[50px] flex items-center justify-center bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition">
                <Plus />
            </button>
        </form>

        {/* Lista */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {loading ? <p className="text-center text-gray-500">Carregando...</p> : 
             categories.length === 0 ? <p className="text-center text-gray-500 text-sm">Nenhuma categoria criada.</p> :
             categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg group">
                    
                    {editingId === cat.id ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input 
                                className="flex-1 bg-gray-50 dark:bg-slate-900 border border-teal-500 rounded px-2 py-1 text-gray-800 dark:text-white outline-none"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                autoFocus
                            />
                            <button onClick={() => saveEdit(cat.id)} className="text-teal-500"><Check size={18}/></button>
                            <button onClick={() => setEditingId(null)} className="text-red-500"><X size={18}/></button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${cat.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                <span className="text-gray-700 dark:text-gray-200 font-medium">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEdit(cat)} className="text-gray-400 hover:text-blue-500"><Edit2 size={16}/></button>
                                <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
}