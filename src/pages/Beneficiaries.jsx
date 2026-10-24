import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { beneficiaries } from '../api/endpoints.js';
import { Empty, ErrorNote, Field, Loading, PageHead } from '../components/ui.jsx';
import { useBanks } from '../lib/banks.js';
import BankPicker from '../components/BankPicker.jsx';

export default function Beneficiaries() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['beneficiaries'], queryFn: beneficiaries.list });
  const bankList = useBanks();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'INTERNAL', walletNumber: '', accountNumber: '', bankCode: '', nickname: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
  const add = useMutation({
    mutationFn: () =>
      beneficiaries.add(
        form.type === 'INTERNAL'
          ? { type: 'INTERNAL', walletNumber: form.walletNumber.trim(), nickname: form.nickname || undefined }
          : {
              type: 'EXTERNAL',
              accountNumber: form.accountNumber.trim(),
              bankCode: form.bankCode,
              nickname: form.nickname || undefined,
            }
      ),
    onSuccess: () => {
      refresh();
      setAdding(false);
      setForm({ ...form, walletNumber: '', accountNumber: '', nickname: '' });
    },
  });
  const remove = useMutation({ mutationFn: beneficiaries.remove, onSuccess: refresh });

  return (
    <div className="page page-narrow">
      <PageHead title="Saved recipients">
        {!adding && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            Add recipient
          </button>
        )}
      </PageHead>

      {adding && (
        <form
          className="form panel"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="segmented" role="tablist">
            <button type="button" role="tab" aria-selected={form.type === 'INTERNAL'} onClick={() => setForm({ ...form, type: 'INTERNAL' })}>
              PayBridge wallet
            </button>
            <button type="button" role="tab" aria-selected={form.type === 'EXTERNAL'} onClick={() => setForm({ ...form, type: 'EXTERNAL' })}>
              Bank account
            </button>
          </div>
          {form.type === 'INTERNAL' ? (
            <Field label="Wallet number">
              <input inputMode="numeric" maxLength={10} value={form.walletNumber} onChange={set('walletNumber')} />
            </Field>
          ) : (
            <>
              <BankPicker
                banks={bankList.banks}
                isLive={bankList.isLive}
                isLoading={bankList.isLoading}
                value={form.bankCode}
                onChange={(code) => setForm({ ...form, bankCode: code })}
              />
              <Field label="Account number">
                <input inputMode="numeric" maxLength={10} value={form.accountNumber} onChange={set('accountNumber')} />
              </Field>
            </>
          )}
          <Field label="Nickname" hint="Optional, e.g. Landlord">
            <input maxLength={100} value={form.nickname} onChange={set('nickname')} />
          </Field>
          <ErrorNote error={add.error} />
          <div className="actions">
            <button className="btn btn-primary" disabled={add.isPending}>
              {add.isPending ? 'Saving…' : 'Save recipient'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {list.isLoading && <Loading />}
      <ErrorNote error={list.error || remove.error} />
      {list.data?.length === 0 && !adding && (
        <Empty>Save people you pay often, and pick them in one tap when you send money.</Empty>
      )}
      {list.data?.length > 0 && (
        <ul className="rows">
          {list.data.map((b) => (
            <li key={b.id} className="row">
              <span className="row-main">
                <strong>{b.nickname || b.name}</strong>
                <span className="muted">
                  {b.nickname ? `${b.name}, ` : ''}
                  {b.type === 'INTERNAL' ? `PayBridge wallet ${b.walletNumber}` : `${bankList.nameOf(b.bankCode)} ${b.accountNumber}`}
                </span>
              </span>
              <button
                className="btn btn-quiet btn-small"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(`Remove ${b.nickname || b.name}?`)) remove.mutate(b.id);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
