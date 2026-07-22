import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { I18nProvider } from './i18n/I18nProvider';
import { AppStoreProvider } from './store/AppStore';
import { ConfirmProvider, ToastProvider } from './components/ui/overlays';

/* Toasts sit above the store so database errors can surface as notifications. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <AppStoreProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </AppStoreProvider>
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
);
