import React from 'react';
import { usePrivacy } from '../../context/PrivacyContext';

/**
 * Componente que oculta o conteúdo se o modo de privacidade estiver ativo.
 * * @param {string|number} value - O valor real a ser exibido.
 * @param {string} mask - O que mostrar quando oculto (padrão: ••••).
 * @param {string} className - Classes CSS adicionais (ex: 'text-red-500').
 */
export const PrivateValue = ({ children, mask = '••••', className = '' }) => {
  const { isPrivacyEnabled } = usePrivacy();

  return (
    <span className={`${className} transition-all duration-300`}>
      {isPrivacyEnabled ? (
        <span className="opacity-60 tracking-widest select-none filter blur-[2px]">{mask}</span>
      ) : (
        children
      )}
    </span>
  );
};