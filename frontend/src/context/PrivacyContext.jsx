import React, { createContext, useContext, useState, useEffect } from 'react';

const PrivacyContext = createContext();

export const PrivacyProvider = ({ children }) => {
  // Estado inicial busca do localStorage ou define como false (visível) por padrão
  const [isPrivacyEnabled, setIsPrivacyEnabled] = useState(() => {
    const saved = localStorage.getItem('domo_privacy_mode');
    return saved === 'true';
  });

  const togglePrivacy = () => {
    setIsPrivacyEnabled((prev) => {
      const newState = !prev;
      localStorage.setItem('domo_privacy_mode', newState);
      return newState;
    });
  };

  return (
    <PrivacyContext.Provider value={{ isPrivacyEnabled, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
};

// Hook personalizado para facilitar o uso
export const usePrivacy = () => useContext(PrivacyContext);