import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints.js';
import { pageOf } from '../../api/client.js';
import ActionDialog from '../../components/ActionDialog.jsx';
import { ErrorNote, Loading, PageHead, Pager, Status } from '../../components/ui.jsx';
import { dateTime, titleCase } from '../../lib/format.js';

const REFRESH = [['admin-customers']];

export default function AdminCustomers() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState(null);
  const q = useQuery({
    queryKey: ['admin-customers', page],
    queryFn: () => admin.customers(page, 50),
    placeholderData: (prev) => prev,
  });
  const p = q.data ? pageOf(q.data) : null;

  const changeTier = (c) => ({
    title: `KYC tier for ${c.fullName}`,
    fields: [
      {
        name: 'tier',
        label: 'Tier',
        type: 'select',
        initial: String(Math.min(c.kycTier + 1, 3)),
        options: [1, 2, 3].map((t) => ({ value: String(t), label: `Tier ${t}` })),
      },
      { name: 'reason', label: 'Reason', type: 'textarea', hint: 'Recorded in the audit trail, e.g. BVN verified, ticket KYC-881' },
    ],
    submitLabel: 'Save tier',
    run: (v) => admin.setTier(c.id, Number(v.tier), v.reason),
    invalidate: REFRESH,
  });

  const changeStatus = (c) => {
    const suspending = c.status === 'ACTIVE';
    return {
      title: `${suspending ? 'Suspend' : 'Reactivate'} ${c.fullName}`,
      description: suspending
        ? 'They are logged out everywhere and cannot move money until reactivated.'
        : 'They can log in and move money again.',
      fields: [{ name: 'reason', label: 'Reason', type: 'textarea' }],
      submitLabel: suspending ? 'Suspend customer' : 'Reactivate customer',
      danger: suspending,
      run: (v) => admin.setCustomerStatus(c.id, suspending ? 'SUSPENDED' : 'ACTIVE', v.reason),
      invalidate: REFRESH,
    };
  };

  const addPartner = {
    title: 'Onboard a remittance partner',
    description: 'Creates their login and an empty USD prefund account. Share the password with them securely.',
    fields: [
      { name: 'name', label: 'Company name' },
      { name: 'email', label: 'Login email', type: 'email' },
      { name: 'password', label: 'Temporary password', hint: 'At least 10 characters' },
    ],
    submitLabel: 'Create partner',
    run: (v) => admin.createPartner(v),
    invalidate: REFRESH,
  };

  return (
    <div className="page">
      <PageHead title="Customers">
        <button className="btn btn-line" onClick={() => setAction(addPartner)}>
          Add partner
        </button>
      </PageHead>
      {q.isLoading && <Loading />}
      <ErrorNote error={q.error} />
      {p && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>KYC tier</th>
                <th>Status</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {p.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.fullName}</strong>
                    <div className="muted small">{c.email}</div>
                  </td>
                  <td>{titleCase(c.role)}</td>
                  <td>{c.role === 'CUSTOMER' ? c.kycTier : '—'}</td>
                  <td>
                    <Status value={c.status} />
                  </td>
                  <td className="nowrap">{dateTime(c.createdAt)}</td>
                  <td className="row-actions">
                    {c.role === 'CUSTOMER' && (
                      <button className="btn btn-quiet btn-small" onClick={() => setAction(changeTier(c))}>
                        Change tier
                      </button>
                    )}
                    {c.role !== 'ADMIN' && (
                      <button className="btn btn-quiet btn-small" onClick={() => setAction(changeStatus(c))}>
                        {c.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p && <Pager page={p.page} totalPages={p.totalPages} onChange={setPage} />}
      <ActionDialog action={action} onClose={() => setAction(null)} />
    </div>
  );
}
