import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, ErrorNote, Field } from './ui.jsx';

/**
 * A dialog with a few fields and one button, for audited admin actions.
 *
 * action = {
 *   title: 'Change KYC tier',
 *   fields: [{ name: 'tier', label: 'New tier', type: 'select', options: [...], initial: '2' }, ...],
 *   submitLabel: 'Save tier',
 *   run: (values) => api call,
 *   invalidate: [['admin-customers']],
 * }
 */
export default function ActionDialog({ action, onClose }) {
  return (
    <Dialog open={!!action} title={action?.title} onClose={onClose}>
      {action && <ActionForm action={action} onDone={onClose} />}
    </Dialog>
  );
}

function ActionForm({ action, onDone }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() =>
    Object.fromEntries(action.fields.map((f) => [f.name, f.initial ?? (f.type === 'checkbox' ? false : '')]))
  );
  const run = useMutation({
    mutationFn: () => action.run(values),
    onSuccess: (data) => {
      (action.invalidate ?? []).forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      action.onSuccess?.(data);
      onDone();
    },
  });

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        run.mutate();
      }}
    >
      {action.description && <p className="muted">{action.description}</p>}
      {action.fields.map((f) => (
        <FieldInput key={f.name} f={f} value={values[f.name]} onChange={(v) => setValues({ ...values, [f.name]: v })} />
      ))}
      <ErrorNote error={run.error} />
      <button className={`btn ${action.danger ? 'btn-danger' : 'btn-primary'}`} disabled={run.isPending}>
        {run.isPending ? 'Working…' : action.submitLabel}
      </button>
    </form>
  );
}

function FieldInput({ f, value, onChange }) {
  if (f.type === 'checkbox') {
    return (
      <label className="check">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {f.label}
      </label>
    );
  }
  return (
    <Field label={f.label} hint={f.hint}>
      {f.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea rows={3} required={f.required !== false} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={f.type || 'text'}
          inputMode={f.inputMode}
          required={f.required !== false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
