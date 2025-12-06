import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Input from './Input';
import MoneyInput from './MoneyInput';
import { Package, Plus, Trash2, ArrowLeft, Search, Tag } from 'lucide-react';

export default function ProductManager({ onBack }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form States
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('un');
  const [price, setPrice] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const response = await api.get('/products/');
      setProducts(response.data);
    } catch (error) {
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!name) return;

    try {
      const finalPrice = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : price;

      await api.post('/products/', { 
          name, 
          measure_unit: unit,
          estimated_price: finalPrice || 0
      });
      
      toast.success("Produto cadastrado!");
      setName('');
      setPrice('');
      fetchProducts(); // Recarrega a lista
      
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar.");
    }
  }

  async function handleDelete(id) {
    if(!confirm("Excluir este produto do catálogo?")) return;
    try {
      await api.delete(`/products/${id}/`);
      toast.success("Excluído.");
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao excluir (pode estar em uso no estoque).");
    }
  }

  return (
    <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center mb-4">
            <button 
                onClick={onBack}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h3 className="ml-auto font-bold text-gray-700 dark:text-gray-200">Catálogo de Produtos</h3>
        </div>

        {/* Form de Criação */}
        <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Novo Produto</h4>
            <form onSubmit={handleCreate} className="space-y-3">
                <div>
                    <Input 
                        placeholder="Nome (ex: Leite, Arroz...)" 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        icon={Package}
                    />
                </div>
                
                <div className="flex gap-3">
                    <div className="flex-1">
                        <MoneyInput 
                            placeholder="Preço Est." 
                            value={price} 
                            onValueChange={setPrice} 
                        />
                    </div>
                    <div className="w-1/3">
                        <select 
                            value={unit}
                            onChange={e => setUnit(e.target.value)}
                            className="w-full h-[54px] px-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="cx">cx</option>
                            <option value="pct">pct</option>
                        </select>
                    </div>
                </div>

                <button type="submit" className="w-full h-[50px] flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition shadow-sm">
                    <Plus size={20} /> Cadastrar Produto
                </button>
            </form>
        </div>

        {/* Lista Simples */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scroll-smooth">
            {loading ? <p className="text-center text-gray-500">Carregando...</p> : 
             products.length === 0 ? <p className="text-center text-gray-500 text-sm">Nenhum produto cadastrado.</p> :
             products.map(prod => (
                <div key={prod.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
                            <Package size={18} />
                        </div>
                        <div>
                            <p className="text-gray-800 dark:text-gray-200 font-medium text-sm">{prod.name}</p>
                            <p className="text-xs text-gray-500">
                                R$ {Number(prod.estimated_price).toFixed(2)} / {prod.measure_unit}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleDelete(prod.id)} 
                        className="text-gray-400 hover:text-red-500 p-2 transition opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 size={16}/>
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
}