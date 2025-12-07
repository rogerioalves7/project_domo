import { useEffect, useState } from 'react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import NewInventoryItemForm from '../components/NewInventoryItemForm';
import ProductManager from '../components/ProductManager';
import MobileMenu from '../components/MobileMenu';
import { 
  Home, BarChart3, Box, ShoppingCart, Settings, 
  Plus, Minus, // Ícones importados aqui
  Search, Package, AlertTriangle, List
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState('ITEM_FORM');
  const [editingItem, setEditingItem] = useState(null);

  async function loadInventory() {
    setLoading(true);
    try {
      const response = await api.get('/inventory/');
      const data = Array.isArray(response.data) ? response.data : [];
      setItems(data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar estoque.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  async function updateQuantity(item, newValue) {
    const newQty = parseFloat(newValue);
    if (isNaN(newQty) || newQty < 0) return;

    // Atualização Otimista
    const oldItems = [...items];
    setItems(items.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));

    try {
        await api.patch(`/inventory/${item.id}/`, { quantity: newQty });
    } catch (error) {
        setItems(oldItems);
        toast.error("Erro ao atualizar.");
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item);
    setModalView('ITEM_FORM');
    setIsModalOpen(true);
  };

  const openNewItem = () => {
    setEditingItem(null);
    setModalView('ITEM_FORM');
    setIsModalOpen(true);
  };

  const openProductManager = () => {
    setModalView('PRODUCT_MANAGER');
    setIsModalOpen(true);
  }

  const filteredItems = items.filter(item => 
    item.product_name && item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans transition-colors duration-300 bg-gray-50 text-gray-900 dark:bg-[#0F172A] dark:text-gray-100">
      
      <div className="hidden md:block h-full shrink-0 relative z-20">
         <Sidebar />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            
            {/* Header */}
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Estoque</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Gerencie sua despensa</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={openProductManager} className="bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 p-3 rounded-xl shadow border border-gray-200 dark:border-slate-700 transition active:scale-95" title="Gerenciar Produtos">
                            <List size={24} />
                        </button>
                        <button onClick={openNewItem} className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl shadow-lg transition active:scale-95">
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Buscar item..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                </div>
            </header>

            {/* Lista de Itens */}
            <main className="px-4 md:px-8 pb-32 md:pb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => {
                        const isLow = parseFloat(item.quantity) <= parseFloat(item.min_quantity);
                        return (
                            <div key={item.id} className={`relative p-4 rounded-2xl border transition-all bg-white dark:bg-[#1E293B] ${isLow ? 'border-rose-300 dark:border-rose-800 ring-1 ring-rose-100 dark:ring-rose-900/20' : 'border-gray-100 dark:border-slate-700'}`}>
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleEdit(item)}>
                                        <div className={`p-3 rounded-full ${isLow ? 'bg-rose-100 text-rose-500 dark:bg-rose-900/30' : 'bg-teal-50 text-teal-600 dark:bg-teal-900/30'}`}>
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg leading-tight">{item.product_name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Mínimo: {item.min_quantity} {item.product_unit}</p>
                                        </div>
                                    </div>
                                    {isLow && <AlertTriangle size={18} className="text-rose-500 animate-pulse" />}
                                </div>

                                {/* CONTROLE DE QUANTIDADE (Estilo Unificado) */}
                                {/* Container único com borda */}
                                <div className="flex items-center h-12 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 overflow-hidden shadow-sm">
                                    
                                    {/* Botão MENOS */}
                                    <button 
                                        onClick={() => updateQuantity(item, parseFloat(item.quantity) - 1)} 
                                        className="h-full px-4 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Minus size={18} strokeWidth={3} />
                                    </button>
                                    
                                    {/* Input Central */}
                                    <input 
                                        type="number"
                                        className="w-full h-full text-center bg-transparent border-none text-gray-900 dark:text-white font-bold text-lg outline-none
                                                   [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity(item, e.target.value)}
                                    />
                                    <span className="text-xs text-gray-400 mr-2 -ml-2 select-none">{item.product_unit}</span>

                                    {/* Botão MAIS */}
                                    <button 
                                        onClick={() => updateQuantity(item, parseFloat(item.quantity) + 1)} 
                                        className="h-full px-4 flex items-center justify-center text-teal-600 hover:text-teal-800 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-900/30 transition-colors"
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                    </button>

                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {filteredItems.length === 0 && !loading && (
                    <div className="text-center py-10 text-gray-400">
                        <Package size={48} className="mx-auto mb-3 opacity-50" />
                        <p>Nenhum item encontrado no estoque.</p>
                    </div>
                )}
            </main>
        </div>
      </div>

      <MobileMenu />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalView === 'PRODUCT_MANAGER' ? '' : (editingItem ? "Editar Item" : "Adicionar ao Estoque")}>
        {modalView === 'ITEM_FORM' && (
            <NewInventoryItemForm 
                initialData={editingItem} 
                onSuccess={() => { setIsModalOpen(false); loadInventory(); }} 
                onCreateProduct={() => setModalView('PRODUCT_MANAGER')} 
                onBack={null} 
            />
        )}
        {modalView === 'PRODUCT_MANAGER' && (
            <ProductManager onBack={() => setModalView('ITEM_FORM')} />
        )}
      </Modal>

    </div>
  );
}