import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useFeatureFlags() {
  const { data } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const res = await api.get('/public/feature-flags');
      return res.data as Record<string, boolean>;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return {
    flags: data || {},
    isEnabled: (flag: string) => data?.[flag] === true,
  };
}
