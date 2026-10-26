// Hebrew and Latin subsets only, so the offline bundle stays small.
import '@fontsource/rubik/hebrew-400.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/hebrew-500.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/hebrew-600.css';
import '@fontsource/rubik/latin-600.css';
import '@fontsource/rubik/hebrew-700.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/hebrew-800.css';
import '@fontsource/rubik/latin-800.css';
import './styles/theme.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyTokens } from './design/tokens';
import { idbStore } from './storage/kv';

applyTokens();

// Ask the browser not to clear progress under storage pressure (granted to installed apps; a no-op elsewhere).
void navigator.storage?.persist?.().catch(() => false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={idbStore()} />
  </StrictMode>,
);
