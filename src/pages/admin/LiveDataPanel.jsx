import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin, fx } from '../../api/endpoints.js';
import { ErrorNote, KeyValues, Loading } from '../../components/ui.jsx';
import { dateTime, rate } from '../../lib/format.js';

// Two pre-demo checks in one place:
//   GET /api/v1/admin/compliance/sanctions/status  -> loaded: true, ~19,000 names
//   GET /api/v1/fx/rates                           -> source: OPEN_ER_API
// Both refresh every 30 seconds, so you can leave the page open while the app warms up.
const SOURCE_LABEL = {
  OPEN_ER_API: 'Live feed (open.er-api.com)',
  MANUAL: 'Set by an admin',
  CONFIG_DEFAULT: 'Default from config (no rate stored yet)',
};

export default function LiveDataPanel() {
  const queryClient = useQueryClient();
  const sanctions = useQuery({ queryKey: ['sanctions'], queryFn: admin.sanctionsStatus, refetchInterval: 30_000 });
  const rates = useQuery({ queryKey: ['rates'], queryFn: fx.rates, refetchInterval: 30_000 });
  const refresh = useMutation({
    mutationFn: admin.refreshSanctions,
    onSuccess: (data) => queryClient.setQueryData(['sanctions'], data),
  });

  const [name, setName] = useState('');
  const screen = useMutation({ mutationFn: () => admin.screenName(name.trim()) });

  const S = sanctions.data;
  const R = rates.data;
  const sanctionsReady = S?.loaded;
  const rateReady = R && R.source === 'OPEN_ER_API' && !R.stale;

  return (
    <section className="panel">
      <div className="block-head">
        <h2>Live data</h2>
        <span className={`status status-${sanctionsReady && rateReady ? 'good' : 'wait'}`}>
          {sanctionsReady && rateReady ? 'Ready' : 'Warming up'}
        </span>
      </div>

      <div className="stat-grid">
        <div className="stack">
          <h3>OFAC sanctions list</h3>
          {sanctions.isLoading && <Loading />}
          <ErrorNote error={sanctions.error || refresh.error} />
          {S && (
            <KeyValues
              rows={[
                ['Loaded', S.loaded ? 'Yes' : 'Not yet'],
                ['Names', S.primaryNames?.toLocaleString('en-NG')],
                ['Aliases', S.aliases?.toLocaleString('en-NG')],
                ['Loaded at', dateTime(S.loadedAt)],
                S.lastError && ['Last error', S.lastError],
              ]}
            />
          )}
          <button
            className="btn btn-quiet btn-small"
            style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? 'Downloading…' : 'Download the list again'}
          </button>
        </div>

        <div className="stack">
          <h3>USD/NGN rate</h3>
          {rates.isLoading && <Loading />}
          <ErrorNote error={rates.error} />
          {R && (
            <KeyValues
              rows={[
                ['Source', SOURCE_LABEL[R.source] ?? R.source],
                ['Mid rate', `₦${rate(R.midRate)}`],
                ['Customer rate', `₦${rate(R.customerRate)}`],
                ['Updated', dateTime(R.asOf)],
                ['Quoting', R.stale ? 'Paused: the rate is out of date' : 'Open'],
              ]}
            />
          )}
        </div>
      </div>

      <form
        className="field-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) screen.mutate();
        }}
      >
        <input
          aria-label="Name to screen"
          placeholder="Screen a name, e.g. Osama bin Laden"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button className="btn btn-line" disabled={!name.trim() || screen.isPending}>
          Screen name
        </button>
      </form>
      <ErrorNote error={screen.error} />
      {screen.data && (
        <p className={`notice ${screen.data.hits.length ? 'notice-bad' : 'notice-good'}`}>
          {screen.data.hits.length
            ? `${screen.data.hits.length} match${screen.data.hits.length > 1 ? 'es' : ''}: ` +
              screen.data.hits
                .slice(0, 3)
                .map((h) => `${h.listedName} (${h.program})`)
                .join('; ')
            : `No match for “${screen.data.name}”.`}
        </p>
      )}
    </section>
  );
}
