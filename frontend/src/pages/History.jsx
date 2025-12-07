import { useEffect, useState } from 'react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import MobileMenu from '../components/MobileMenu';
import { 
  BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Calendar, PieChart
} from 'lucide-react';
import { 
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend 
} from 'recharts';
import toast from 'react-hot-toast';

// Paleta de cores para o gráfico (Tons de Teal e Azul)
const COLORS = ['#0D9488', '#2DD4BF', '#0F766E', '#99F6E4', '#115E59', '#CCFBF1', '#3B82F6', '#60A5FA'];

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await api.get('/history/');
        const data = Array.isArray(response.data) ? response.data : [];
        setHistoryData(data);
        
        // Expande o primeiro mês automaticamente se houver dados
        if (data.length > 0) {
            setExpandedMonth(data[0].id);
        }
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar histórico.");
        setHistoryData([]);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const toggleMonth = (id) => {
    setExpandedMonth(expandedMonth === id ? null : id);
  };

  const formatMonthTitle = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(adjustedDate);
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden font-sans bg-gray-50 dark:bg-[#0F172A] dark:text-gray-100">
      
      <div className="hidden md:block h-full shrink-0 relative z-20">
         <Sidebar />
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
            
            <header className="px-4 py-6 md:px-8 md:py-8 shrink-0">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <BarChart3 className="text-teal-500" /> Histórico Financeiro
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Análise mensal de gastos e receitas.</p>
            </header>

            <main className="px-4 md:px-8 pb-32 md:pb-10">
                
                {loading && (
                    <div className="text-center py-10 text-gray-400 animate-pulse">Carregando dados...</div>
                )}

                {!loading && historyData.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        <Calendar size={48} className="mx-auto mb-3 opacity-50" />
                        <p>Nenhum histórico disponível ainda.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {historyData.map(monthData => {
                        const isExpanded = expandedMonth === monthData.id;
                        const percentageUsed = monthData.estimated > 0 
                            ? Math.min(100, (monthData.expense / monthData.estimated) * 100) 
                            : 0;

                        return (
                            <div key={monthData.id} className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden transition-all">
                                
                                {/* Cabeçalho do Mês */}
                                <div 
                                    onClick={() => toggleMonth(monthData.id)}
                                    className="p-4 md:p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="flex justify-between items-center mb-3">
                                        <h2 className="text-lg md:text-xl font-bold capitalize text-gray-800 dark:text-white">
                                            {formatMonthTitle(monthData.date)}
                                        </h2>
                                        {isExpanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-emerald-500">Receitas</p>
                                            <p className="font-bold text-emerald-600 dark:text-emerald-400">R$ {monthData.income.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-rose-500">Despesas</p>
                                            <p className="font-bold text-rose-600 dark:text-rose-400">R$ {monthData.expense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-gray-400">Estimado (Fixo)</p>
                                            <p className="font-bold text-gray-600 dark:text-gray-300">R$ {monthData.estimated.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                        </div>
                                        <div className="md:text-right">
                                            <p className="text-[10px] uppercase font-bold text-blue-500">Saldo</p>
                                            <p className={`font-bold ${monthData.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
                                                R$ {monthData.balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Barra de Progresso */}
                                    <div className="relative h-1.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${percentageUsed > 100 ? 'bg-rose-500' : 'bg-teal-500'}`}
                                            style={{ width: `${percentageUsed}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Detalhes Expandidos */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-slate-700 p-4 md:p-6 bg-gray-50/50 dark:bg-slate-900/30 animate-fade-in-down">
                                        <div className="flex flex-col lg:flex-row gap-8">
                                            
                                            {/* GRÁFICO CORRIGIDO */}
                                            <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
                                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                    <PieChart size={16}/> Distribuição de Despesas
                                                </h3>
                                                
                                                {monthData.chart_data && monthData.chart_data.length > 0 ? (
                                                    <div className="w-full h-[250px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <RePieChart>
                                                                <Pie
                                                                    data={monthData.chart_data}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={60}
                                                                    outerRadius={80}
                                                                    paddingAngle={5}
                                                                    dataKey="value"
                                                                    nameKey="name" // Importante para o Tooltip
                                                                >
                                                                    {monthData.chart_data.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                                                    ))}
                                                                </Pie>
                                                                <ReTooltip 
                                                                    formatter={(value) => `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
                                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                />
                                                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                                            </RePieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-400 mt-10">Sem despesas categorizadas.</p>
                                                )}
                                            </div>

                                            {/* Lista de Transações */}
                                            <div className="flex-1">
                                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Extrato do Mês</h3>
                                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {monthData.transactions.map(trans => (
                                                        <div key={trans.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-full ${trans.type === 'EXPENSE' ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
                                                                    {trans.type === 'EXPENSE' ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{trans.description}</p>
                                                                    <p className="text-[10px] text-gray-500">{new Date(trans.date).toLocaleDateString('pt-BR')} • {trans.category}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`font-bold text-sm ${trans.type === 'EXPENSE' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                {trans.type === 'EXPENSE' ? '-' : '+'} R$ {trans.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
      </div>

      <MobileMenu />
    </div>
  );
}