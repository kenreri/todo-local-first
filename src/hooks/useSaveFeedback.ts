import { useRef, useState } from 'react';

/** UI feedback only; transaction serialization belongs in the persistence layer. */
export function useSaveFeedback() {
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (operation: () => Promise<unknown>): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setSaving(true);
    setFailed(false);
    try {
      await operation();
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return { run, saving, failed };
}
