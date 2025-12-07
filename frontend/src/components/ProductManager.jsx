import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Input from './Input';
import MoneyInput from './MoneyInput';
import { Package, Plus, Trash2, ArrowLeft, Minus } from 'lucide-react';

export default function ProductManager({ onBack }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('un');
  const [price, setPrice] = useState('');
  const [minQty, setMinQty] = useState('1');

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
      const finalPrice = price || 0;
      await api.post('/products/', { 
          name, 
          measure_unit: unit,
          estimated_price: finalPrice,
          min_quantity: parseFloat(minQty) || 1 
      });
      
      toast.success("Produto cadastrado!");
      setName('');
      setPrice('');
      setMinQty('1'); 
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar.");
    }
  }

  function handleDelete(id) {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[200px]">
        <div className="font-medium text-gray-800">Excluir produto?</div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded">Cancelar</button>
          <button onClick={() => { toast.dismiss(t.id); confirmDelete(id); }} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded">Excluir</button>
        </div>
      </div>
    ), { duration: 5000, position: 'top-center' });
  }

  async function confirmDelete(id) {
    try {
      await api.delete(`/products/${id}/`);
      toast.success("Excluído.", { icon: '🗑️' });
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao excluir (pode estar em uso).");
    }
  }

  // Helper de incremento
  const handleStep = (delta) => {
    const val = parseFloat(minQty) || 0;
    const newVal = val + delta;
    if (newVal < 0) return;
    setMinQty(String(newVal));
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center mb-4">
            <button 
                onClick={onBack}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h3 className="ml-auto font-bold text-gray-700 dark:text-gray-200">Catálogo de Produtos</h3>
        </div>

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
                
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                        <MoneyInput 
                            placeholder="Preço Est." 
                            value={price} 
                            onValueChange={setPrice} 
                        />
                    </div>
                    
                    {/* CAMPO MÍNIMO (STEPPER INTEGRADO) */}
                    <div className="col-span-1">
                        <div className="flex items-center h-[54px] w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                            <button 
                                type="button"
                                onClick={() => handleStep(-1)}
                                className="h-full px-2 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Minus size={14} strokeWidth={2.5} />
                            </button>
                            <input 
                                type="number" 
                                placeholder="Mín"
                                className="w-full h-full text-center bg-transparent border-none text-gray-800 dark:text-white font-bold outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={minQty}
                                onChange={e => setMinQty(e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={() => handleStep(1)}
                                className="h-full px-2 flex items-center justify-center text-teal-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                            >
                                <Plus size={14} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    <div className="col-span-1">
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

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scroll-smooth">
            {products.map(prod => (
                <div key={prod.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
                            <Package size={18} />
                        </div>
                        <div>
                            <p className="text-gray-800 dark:text-gray-200 font-medium text-sm">{prod.name}</p>
                            <p className="text-xs text-gray-500">
                                Mín: {prod.min_quantity} {prod.measure_unit} • R$ {Number(prod.estimated_price).toFixed(2)}
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