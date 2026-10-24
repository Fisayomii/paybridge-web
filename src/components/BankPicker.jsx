import { useMemo, useState } from 'react';
import { Field } from './ui.jsx';

// A bank <select> with a filter box above it: Paystack lists a couple of hundred banks.
export default function BankPicker({ banks, value, onChange, isLive, isLoading }) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? banks.filter((b) => b.name.toLowerCase().includes(f) || b.code.includes(f)) : banks;
    // Keep the selected bank visible even when the filter hides it.
    const selected = banks.find((b) => b.code === value);
    return selected && !list.includes(selected) ? [selected, ...list] : list;
  }, [banks, filter, value]);

  return (
    <div className="bank-picker">
      <Field
        label="Bank"
        hint={
          isLoading ? 'Loading banks…' : isLive ? `${banks.length} banks from Paystack` : 'Showing a short list (the bank list could not be loaded)'
        }
      >
        <input
          type="search"
          placeholder="Search banks, e.g. Kuda"
          aria-label="Search banks"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select aria-label="Bank" value={value} onChange={(e) => onChange(e.target.value)} size={1}>
          {!value && <option value="">Choose a bank</option>}
          {shown.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
