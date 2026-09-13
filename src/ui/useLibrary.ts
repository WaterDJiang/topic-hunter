import { useCallback, useEffect, useState } from 'react';
import type { LibrarySnapshot } from '../domain/types';
import { sendCommand } from '../lib/messages';

export function useLibrary() {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setSnapshot(await sendCommand<LibrarySnapshot>({ type: 'snapshot' }));
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '无法读取本地资料');
    }
  }, []);
  useEffect(() => {
    void refresh();
    const listener = (message: { type?: string }) => {
      if (message?.type === 'dataChanged' || message?.type === 'settingsChanged') void refresh();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refresh]);
  return { snapshot, error, refresh };
}
