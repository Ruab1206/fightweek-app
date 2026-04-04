// ──────────────────────────────────────────────
// useSearchField — search bar keyboard behaviour
// Ported from Toolbox design-system
// ──────────────────────────────────────────────
import { useRef, useState, useCallback } from 'react';

export interface SearchField {
  ref: React.RefObject<HTMLInputElement>;
  term: string;
  setTerm: (v: string) => void;
  clear: () => void;
  handleKey: (e: KeyboardEvent) => boolean;
  inputProps: {
    ref: React.RefObject<HTMLInputElement>;
    type: 'text';
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  };
}

export function useSearchField(context: string): SearchField {
  const ref = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const clear = useCallback(() => setTerm(''), []);

  const handleKey = useCallback((e: KeyboardEvent): boolean => {
    const tag = (e.target as HTMLElement)?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if ((e.key === 'æ' || e.key === 'Æ') && !inInput) {
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
      return true;
    }

    if (e.key === 'Escape' && document.activeElement === ref.current) {
      e.preventDefault();
      ref.current?.blur();
      return true;
    }

    return false;
  }, []);

  const onInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); ref.current?.blur(); }
  }, []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setTerm(e.target.value), []);

  return {
    ref, term, setTerm, clear, handleKey,
    inputProps: {
      ref,
      type: 'text' as const,
      value: term,
      onChange,
      placeholder: `Search ${context}… (æ)`,
      onKeyDown: onInputKeyDown,
    },
  };
}
