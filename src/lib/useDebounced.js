import { useEffect, useState } from 'react';

// Returns `value` only after it has stopped changing for `delay` ms.
// Stops the fee quote and name enquiry from firing on every keystroke.
export function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
