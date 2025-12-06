import { createContext, useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  
  // Ao abrir o app, verifica se já existe um token salvo
  useEffect(() => {
    const storagedToken = localStorage.getItem('@MyHome:token');
    const storagedUser = localStorage.getItem('@MyHome:user');

    if (storagedToken && storagedUser) {
      api.defaults.headers.Authorization = `Token ${storagedToken}`;
      setUser(JSON.parse(storagedUser));
    }
  }, []);

  async function signIn({ username, password }) {
    try {
      // 1. Tenta fazer login no Django
      const response = await api.post('http://127.0.0.1:8000/api-token-auth/', {
        username, // O Django espera 'username', não email por padrão
        password,
      });

      // 2. Se der certo, pega o token
      const { token } = response.data;

      // 3. Salva no navegador/celular para não deslogar ao fechar
      localStorage.setItem('@MyHome:token', token);
      localStorage.setItem('@MyHome:user', JSON.stringify({ username }));

      // 4. Configura o Axios para todas as próximas requisições terem o token
      api.defaults.headers.Authorization = `Token ${token}`;

      // 5. Atualiza o estado global
      setUser({ username });
      
      toast.success(`Bem-vindo de volta, ${username}!`);

    } catch (error) {
      console.error(error);
      toast.error("Falha no login. Verifique suas credenciais.");
      throw error; // Repassa o erro para o componente tratar se precisar
    }
  }

  function signOut() {
    localStorage.removeItem('@MyHome:token');
    localStorage.removeItem('@MyHome:user');
    api.defaults.headers.Authorization = undefined;
    setUser(null);
    toast('Até logo!', { icon: '👋' });
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}