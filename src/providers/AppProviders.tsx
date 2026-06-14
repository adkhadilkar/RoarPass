import React, { useEffect } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { isRTL } from '../i18n/config';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';

function DirectionManager({ children }: { children: React.ReactNode }) {
  const { i18n: instance } = useTranslation();
  useEffect(() => {
    const dir = isRTL(instance.language) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', instance.language);
  }, [instance.language]);
  return <>{children}</>;
}

// Merged: foundation supplies i18n + direction handling; security branch
// supplies AuthProvider. Both wrap the tree — auth inside i18n so auth
// error messages are localized and direction-aware.
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <DirectionManager>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </DirectionManager>
    </I18nextProvider>
  );
}