import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Input from '../components/Input';
import logoImg from '../assets/logo.png'; // <--- Import da Imagem
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react'; 

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn } = useContext(AuthContext);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true);
    
    try {
        await signIn({ username, password });
        navigate('/app');
    } catch (error) {
        setLoading(false);
        // O toast de erro já é disparado no Contexto
    }
  }

  return (
    // ROOT: w-screen h-screen garante ocupação total
    <div className="flex w-screen h-screen overflow-hidden bg-gray-50 dark:bg-[#0F172A]">
      
      {/* --- LADO ESQUERDO (Visual / Desktop) --- */}
      <div className="hidden md:flex w-1/2 lg:w-3/5 h-full bg-gradient-to-br from-teal-600 to-blue-800 items-center justify-center relative overflow-hidden">
        
        {/* Elementos Decorativos */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-white opacity-5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-500 opacity-20 rounded-full blur-3xl"></div>

        {/* Branding Central */}
        <div className="relative z-10 flex flex-col items-center text-white animate-fade-in-up p-12 text-center">
            
            {/* LOGO GRANDE DESKTOP */}
            <div className="mb-8 drop-shadow-2xl">
                <img 
                    src={logoImg} 
                    alt="Logo Domo" 
                    className="h-32 w-auto object-contain" // Ajuste o h-32 se quiser maior ou menor
                />
            </div>
    
            <p className="text-blue-100 text-lg lg:text-xl font-medium max-w-lg leading-relaxed">
                Assuma o controle da sua casa. <br/>
                Gestão financeira e estoque em um só lugar.
            </p>
        </div>
      </div>

      {/* --- LADO DIREITO (Formulário) --- */}
      <div className="w-full md:w-1/2 lg:w-2/5 h-full flex flex-col justify-center items-center p-8 lg:p-12 transition-colors duration-300 overflow-y-auto relative">
        
        <div className="w-full max-w-sm space-y-8">
            
            {/* Cabeçalho Mobile (Só aparece em telas < md) */}
            <div className="md:hidden flex flex-col items-center mb-8 mt-10">
                <div className="mb-4 drop-shadow-lg">
                    <img 
                        src={logoImg} 
                        alt="Logo Domo" 
                        className="h-16 w-auto object-contain" 
                    />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Domo</h1>
            </div>

            {/* Boas vindas */}
            <div className="text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Bem-vindo de volta
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-base">
                    Insira suas credenciais para acessar.
                </p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Usuário</label>
                    <Input
                        type="text"
                        placeholder="Seu nome de usuário"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        icon={User}
                        autoFocus
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5 ml-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
                        <a href="#" className="text-xs font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400">Esqueceu?</a>
                    </div>
                    <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        icon={Lock}
                    />
                  </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-500/30 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                    <>
                    Entrar <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center pb-8 md:pb-0">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ainda não possui uma casa?{' '}
                    <button className="text-teal-600 dark:text-teal-400 font-semibold hover:underline transition-colors">
                        Criar nova conta
                    </button>
                </p>
            </div>
        </div>

        {/* Footer */}
        <div className="md:absolute bottom-6 text-center text-xs text-gray-400 dark:text-slate-600 w-full">
            © 2025 Project Domo. Todos os direitos reservados.
        </div>

      </div>
    </div>
  );
}