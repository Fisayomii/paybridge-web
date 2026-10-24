import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { beneficiaries, transfers, wallets } from '../api/endpoints.js';
import { ErrorNote, Field, Loading, PageHead } from '../components/ui.jsx';
import { useBanks } from '../lib/banks.js';
import BankPicker from '../components/BankPicker.jsx';
import { money, newKey } from '../lib/format.js';
import { useDebounced } from '../lib/useDebounced.js';

const EMPTY = {
  walletNumber: '',
  accountNumber: '',
  bankCode: '',
  amount: '',
  narration: '',
  save: false,
};

export default function SendMoney() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [type, setType] = useState('INTERNAL'); // INTERNAL = PayBridge wallet, EXTERNAL = bank
  const [form, setForm] = useState(EMPTY);
  const [sourceWallet, setSourceWallet] = useState('');
  const [saved, setSaved] = useState(null); // a saved beneficiary, if one is picked

  // One key per attempt to send. If the network drops and you press Send again, the backend sees
  // the same key and returns the original transfer instead of sending the money twice.
  const idempotencyKey = useRef(newKey('send'));

  const walletsQ = useQuery({ queryKey: ['wallets'], queryFn: wallets.list });
  const savedQ = useQuery({ queryKey: ['beneficiaries'], queryFn: beneficiaries.list });
  const bankList = useBanks();

  const myWallets = (walletsQ.data ?? []).filter((w) => w.currency === 'NGN');
  const from = myWallets.find((w) => w.walletNumber === sourceWallet) ?? myWallets[0];
  const bankCode = form.bankCode;
  const savedOfType = (savedQ.data ?? []).filter((b) => b.type === type);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  // ---- Name enquiry: who is this money going to?
  const walletNo = useDebounced(form.walletNumber.trim());
  const lookup = useQuery({
    queryKey: ['lookup', walletNo],
    queryFn: () => wallets.lookup(walletNo),
    enabled: type === 'INTERNAL' && !saved && /^\d{10}$/.test(walletNo),
    retry: false,
  });

  const acctNo = useDebounced(form.accountNumber.trim());
  const resolve = useQuery({
    queryKey: ['resolve', acctNo, bankCode],
    queryFn: () => transfers.resolveBank(acctNo, bankCode),
    enabled: type === 'EXTERNAL' && !saved && /^\d{10}$/.test(acctNo) && /^\d{3,6}$/.test(bankCode),
    retry: false,
  });

  // ---- Fee quote, refreshed as the amount changes
  const amount = useDebounced(form.amount);
  const fee = useQuery({
    queryKey: ['fee', type, amount],
    queryFn: () => transfers.fee(type, amount),
    enabled: Number(amount) > 0,
    retry: false,
  });

  const recipientName =
    saved?.name ?? (type === 'INTERNAL' ? lookup.data?.accountName : resolve.data?.accountName);

  const send = useMutation({
    mutationFn: () => {
      const common = {
        sourceWalletNumber: from.walletNumber,
        amount: Number(form.amount).toFixed(2),
        narration: form.narration.trim(),
        beneficiaryId: saved?.id,
        saveBeneficiary: !saved && form.save,
      };
      return type === 'INTERNAL'
        ? transfers.sendInternal(
            { ...common, destinationWalletNumber: saved ? undefined : form.walletNumber.trim() },
            idempotencyKey.current
          )
        : transfers.sendExternal(
            {
              ...common,
              beneficiaryAccountNumber: saved ? undefined : form.accountNumber.trim(),
              beneficiaryBankCode: saved ? undefined : bankCode,
            },
            idempotencyKey.current
          );
    },
    onSuccess: (transfer) => {
      idempotencyKey.current = newKey('send');
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      navigate(`/transfers/${transfer.reference}`, { state: { justSent: true } });
    },
  });

  function switchType(next) {
    setType(next);
    setSaved(null);
    send.reset();
  }

  const canSend =
    from && Number(form.amount) > 0 && form.narration.trim() && (saved || recipientName) && !send.isPending;

  if (walletsQ.isLoading) return <Loading label="Loading your wallets" />;

  return (
    <div className="page page-narrow">
      <PageHead title="Send money" />

      <div className="segmented" role="tablist" aria-label="Where to send">
        <button role="tab" aria-selected={type === 'INTERNAL'} onClick={() => switchType('INTERNAL')}>
          To a PayBridge wallet
        </button>
        <button role="tab" aria-selected={type === 'EXTERNAL'} onClick={() => switchType('EXTERNAL')}>
          To a bank account
        </button>
      </div>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) send.mutate();
        }}
      >
        {myWallets.length > 1 && (
          <Field label="From">
            <select value={from?.walletNumber} onChange={(e) => setSourceWallet(e.target.value)}>
              {myWallets.map((w) => (
                <option key={w.walletNumber} value={w.walletNumber}>
                  {w.walletNumber}, {money(w.balance, w.currency)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {from && (
          <p className="muted">
            Sending from {from.walletNumber}. Available: <strong className="num">{money(from.balance)}</strong>
          </p>
        )}

        {savedOfType.length > 0 && (
          <div className="saved-pick">
            <span className="field-label">Saved recipients</span>
            <div className="chips">
              {savedOfType.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={`chip ${saved?.id === b.id ? 'chip-on' : ''}`}
                  aria-pressed={saved?.id === b.id}
                  onClick={() => setSaved(saved?.id === b.id ? null : b)}
                >
                  {b.nickname || b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {saved ? (
          <div className="recipient">
            <strong>{saved.name}</strong>
            <span className="muted">
              {type === 'INTERNAL'
                ? `PayBridge wallet ${saved.walletNumber}`
                : `${bankList.nameOf(saved.bankCode)}, ${saved.accountNumber}`}
            </span>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setSaved(null)}>
              Use someone else
            </button>
          </div>
        ) : type === 'INTERNAL' ? (
          <Field
            label="Recipient's wallet number"
            error={lookup.error?.message}
            hint={lookup.isFetching ? 'Checking…' : undefined}
          >
            <input
              inputMode="numeric"
              maxLength={10}
              placeholder="10 digits"
              value={form.walletNumber}
              onChange={set('walletNumber')}
            />
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
            <Field
              label="Account number"
              error={resolve.error?.message}
              hint={resolve.isFetching ? 'Checking the account…' : undefined}
            >
              <input
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit NUBAN"
                value={form.accountNumber}
                onChange={set('accountNumber')}
              />
            </Field>
          </>
        )}

        {!saved && recipientName && (
          <p className="confirmed-name">
            Sending to <strong>{recipientName}</strong>
          </p>
        )}

        <Field label="Amount (₦)" hint={type === 'EXTERNAL' ? 'At least ₦100' : undefined}>
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })}
          />
        </Field>
        {fee.data && (
          <p className="muted">
            Fee {money(fee.data.fee)}. Total from your wallet:{' '}
            <strong className="num">{money(fee.data.totalDebit)}</strong>
          </p>
        )}

        <Field label="Description" hint="The recipient sees this">
          <input
            maxLength={type === 'EXTERNAL' ? 200 : 255}
            placeholder="e.g. Rent for October"
            value={form.narration}
            onChange={set('narration')}
          />
        </Field>

        {!saved && (
          <label className="check">
            <input type="checkbox" checked={form.save} onChange={set('save')} />
            Save this recipient for next time
          </label>
        )}

        <ErrorNote error={send.error} />
        <button className="btn btn-primary btn-wide" disabled={!canSend}>
          {send.isPending ? 'Sending…' : form.amount ? `Send ${money(form.amount)}` : 'Send'}
        </button>
      </form>
    </div>
  );
}
