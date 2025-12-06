import { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Tenta pegar do localStorage, se não tiver, usa 'dark' como padrão (já que seu design atual é dark)
  const [theme, setTheme] = useState(() => {
    const storageTheme = localStorage.getItem('@MyHome:theme');
    return storageTheme || 'dark'; 
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove a classe antiga e adiciona a nova
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // Salva a preferência
    localStorage.setItem('@MyHome:theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}