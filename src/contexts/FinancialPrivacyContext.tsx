import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface FinancialPrivacyContextType {
  isHidden: boolean;
  toggle: () => void;
  maskValue: (value: string | number, prefix?: string) => string;
}

const FinancialPrivacyContext = createContext<FinancialPrivacyContextType>({
  isHidden: false,
  toggle: () => {},
  maskValue: (v) => String(v),
});

const STORAGE_KEY = 'financial_visibility';

export const FinancialPrivacyProvider = ({ children }: { children: ReactNode }) => {
  const [isHidden, setIsHidden] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'hidden';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setIsHidden(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'hidden' : 'visible');
      } catch {}
      return next;
    });
  }, []);

  const maskValue = useCallback((value: string | number, prefix = 'R$ ') => {
    if (isHidden) return `${prefix}•••••`;
    return typeof value === 'number' ? `${prefix}${value.toFixed(2)}` : `${prefix}${value}`;
  }, [isHidden]);

  return (
    <FinancialPrivacyContext.Provider value={{ isHidden, toggle, maskValue }}>
      {children}
    </FinancialPrivacyContext.Provider>
  );
};

export const useFinancialPrivacy = () => useContext(FinancialPrivacyContext);
