import { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function FinancialCharts({ transactions, period }) {
  
  // Cores do Tema (Combinando com seu Tailwind)
  const COLORS = ['#0EA5E9', '#8B5CF6', '#F43F5E', '#10B981', '#F59E0B', '#64748B'];
  
  // --- PROCESSAMENTO DE DADOS (Fluxo de Caixa) ---
  const dataCashFlow = useMemo(() => {
    // Agrupa por data (simplificado para agrupar por dia ou mês dependendo da qtd de dados)
    const grouped = {};
    
    transactions.forEach(t => {
      // Pega a data (ex: "12/05")
      const dateObj = new Date(t.date + 'T12:00:00');
      const key = period === 'YEAR' 
        ? dateObj.toLocaleDateString('pt-BR', { month: 'short' }) // Jan, Fev...
        : dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); // 12/05

      if (!grouped[key]) grouped[key] = { name: key, income: 0, expense: 0 };
      
      if (t.type === 'INCOME') {
        grouped[key].income += Number(t.value);
      } else {
        grouped[key].expense += Number(t.value);
      }
    });

    // Transforma em array e inverte para ficar cronológico (se a lista vier decrescente)
    return Object.values(grouped).reverse();
  }, [transactions, period]);

  // --- PROCESSAMENTO DE DADOS (Categorias) ---
  const dataCategories = useMemo(() => {
    const grouped = {};
    
    transactions
      .filter(t => t.type === 'EXPENSE') // Só queremos analisar gastos
      .forEach(t => {
        const catName = t.category_name || 'Sem Categoria';
        if (!grouped[catName]) grouped[catName] = 0;
        grouped[catName] += Number(t.value);
      });

    // Transforma em array, ordena por valor e pega Top 5
    const sorted = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);

    if (others > 0) top5.push({ name: 'Outros', value: others });

    return top5;
  }, [transactions]);

  // Se não tem dados, não mostra nada
  if (transactions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      
      {/* GRÁFICO 1: FLUXO DE CAIXA */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-6">Entradas vs Saídas</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataCashFlow}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94A3B8', fontSize: 12}} 
                dy={10}
              />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="income" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="expense" name="Despesas" fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRÁFICO 2: POR CATEGORIA */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2">Gastos por Categoria</h3>
        <div className="flex-1 flex items-center justify-center h-[250px]">
           <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataCategories}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {dataCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip 
                 formatter={(value) => `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend 
                layout="vertical" 
                verticalAlign="middle" 
                align="right"
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}