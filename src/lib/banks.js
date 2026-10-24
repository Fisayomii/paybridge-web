// Banks come from the backend (GET /api/v1/transfers/banks), which gets them from Paystack's GET /bank
// and caches them for a day. FALLBACK_BANKS is only used while that request is loading or if it fails.
import { useQuery } from '@tanstack/react-query';
import { transfers } from '../api/endpoints.js';

export const FALLBACK_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '50211', name: 'Kuda Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
];

export function useBanks() {
  const q = useQuery({
    queryKey: ['banks'],
    queryFn: transfers.banks,
    staleTime: 6 * 60 * 60 * 1000, // the list barely changes; the backend caches it for a day too
    retry: 1,
  });
  const banks = q.data?.length ? q.data : FALLBACK_BANKS;
  const byCode = new Map(banks.map((b) => [b.code, b.name]));
  return {
    banks,
    isLive: Boolean(q.data?.length),
    isLoading: q.isLoading,
    error: q.error,
    nameOf: (code) => byCode.get(code) ?? (code ? `Bank ${code}` : ''),
  };
}
