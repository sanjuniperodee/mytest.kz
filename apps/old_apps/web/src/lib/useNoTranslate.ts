import { useEffect } from 'react';

/** Disables browser auto-translate on exam UI (questions must stay verbatim). */
export function useNoTranslateWhileMounted() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('translate', 'no');
    root.classList.add('notranslate');
    return () => {
      root.removeAttribute('translate');
      root.classList.remove('notranslate');
    };
  }, []);
}
