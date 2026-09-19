import { useState, useEffect, useRef } from 'react';
import client from '../api/client';

/**
 * Hook que hace un ping al backend al montar el componente.
 * Devuelve:
 *   - ready: true cuando el backend respondio
 *   - slow:  true si tardo mas de SLOW_THRESHOLD_MS (servidor dormido)
 */
const SLOW_THRESHOLD_MS = 3000;

export function useServerWarmup() {
  const [ready, setReady] = useState(false);
  const [slow,  setSlow]  = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    timerRef.current = setTimeout(() => {
      if (!cancelled) setSlow(true);
    }, SLOW_THRESHOLD_MS);

    client.get('/health')
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          clearTimeout(timerRef.current);
          setReady(true);
          setSlow(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, []);

  return { ready, slow };
}
