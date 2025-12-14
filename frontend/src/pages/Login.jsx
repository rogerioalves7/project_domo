import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import toast from 'react-hot-toast';
import { User, Mail, Lock, ArrowRight, Loader2, AtSign } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState(''); 
  const [username, setUsername] = useState(''); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn({ username, password });
        navigate('/dashboard');
      } else {
        if (username.includes(' ')) {
            toast.error("O usuário não pode conter espaços.");
            setLoading(false);
            return;
        }

        await signUp({ 
            username,
            first_name: fullName,
            email, 
            password 
        });
        
        toast.success("Conta criada! Entrando...");

        try {
            await signIn({ username, password });
            navigate('/dashboard');
        } catch (loginError) {
            console.error(loginError);
            toast.error("Erro no login automático.");
            setIsLogin(true);
        }
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.detail || "Erro na operação.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-white dark:bg-[#0F172A] grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
      
      {/* --- LADO ESQUERDO (HERO - DESKTOP) --- */}
      <div className="hidden lg:flex relative bg-teal-600 flex-col justify-between p-12 h-full w-full">
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '30px 30px' }}>
        </div>
        
        <div className="relative z-10 mt-10">
            <div className="bg-white p-6 rounded-3xl shadow-2xl w-fit mb-12 mx-auto">
                <img src={logoImg} alt="Domo" className="h-36 w-auto" />
            </div>
            <h1 className="text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight">
                Controle financeiro <br/> 
                <span className="text-teal-200">inteligente e simples.</span>
            </h1>
            <p className="text-teal-50 text-lg max-w-md leading-relaxed">
                Junte-se ao Domo para gerenciar despesas compartilhadas, cartões e contas da casa em um único lugar.
            </p>
        </div>

        <div className="relative z-10 text-teal-200 text-sm font-medium">
            © {new Date().getFullYear()} Project Domo. Todos os direitos reservados.
        </div>
      </div>

      {/* --- LADO DIREITO (FORMULÁRIO) --- */}
      <div className="h-full w-full bg-gray-50 dark:bg-[#0F172A] overflow-y-auto relative">
        
        <div className="min-h-full w-full flex flex-col p-6 md:p-12">
            
            <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto space-y-8">
                
                {/* --- LOGO MOBILE (AUMENTADO) --- */}
                <div className="lg:hidden text-center mb-6 mt-4">
                    {/* AUMENTO: p-5 (era p-3), rounded-3xl (era 2xl) */}
                    <div className="bg-white p-5 rounded-3xl shadow-xl w-fit mx-auto mb-6">
                        {/* AUMENTO: h-28 (112px) - era h-10 (40px) */}
                        <img src={logoImg} alt="Domo" className="h-28 w-auto" />
                    </div>
                </div>

                <div className="text-center lg:text-left">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
                    </h2>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">
                        {isLogin ? 'Entre com suas credenciais.' : 'Preencha os dados abaixo.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 w-full">
                    
                    {!isLogin && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5 ml-1">Nome Completo</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><User size={18} /></div>
                                    <input 
                                        type="text" placeholder="Ex: Jéssica Leite" 
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all text-sm font-medium"
                                        value={fullName} onChange={e => setFullName(e.target.value)} required={!isLogin}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5 ml-1">E-mail</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Mail size={18} /></div>
                                    <input 
                                        type="email" placeholder="seu@email.com" 
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all text-sm font-medium"
                                        value={email} onChange={e => setEmail(e.target.value)} required={!isLogin}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5 ml-1">
                            {isLogin ? 'Usuário' : 'Criar Usuário (Sem espaços)'}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><AtSign size={18} /></div>
                            <input 
                                type="text" placeholder="Ex: jessica.leite" 
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all text-sm font-medium"
                                value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-1.5 ml-1">Senha</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Lock size={18} /></div>
                            <input 
                                type="password" placeholder="******" 
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 dark:text-white transition-all text-sm font-medium"
                                value={password} onChange={e => setPassword(e.target.value)} required
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" disabled={loading}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Acessar Sistema' : 'Criar Conta')}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div className="text-center">
                    <button 
                        onClick={() => { setIsLogin(!isLogin); setFullName(''); setUsername(''); setEmail(''); setPassword(''); }}
                        className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 hover:underline transition"
                    >
                        {isLogin ? 'Ainda não tem conta? Cadastre-se' : 'Já tem cadastro? Faça Login'}
                    </button>
                </div>
            </div>

            {/* RODAPÉ MOBILE */}
            <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500 lg:hidden pb-2">
                © {new Date().getFullYear()} Project Domo. Todos os direitos reservados.
            </div>

        </div>
      </div>
    </div>
  );
}