import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { useMessage } from '../../../hooks/useMessage';
import type { HealthState } from './types';

interface UseHealthCheckOptions {
  mutationFn: () => Promise<{ ok: boolean; reason?: string; status?: number; latencyMs?: number; model?: string }>;
  successKey: string;
  failKey: string;
}

export const useHealthCheck = ({ mutationFn, successKey, failKey }: UseHealthCheckOptions) => {
  const { t } = useI18n();
  const message = useMessage();
  const [health, setHealth] = useState<HealthState | null>(null);

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data) => {
      setHealth({
        ok: data.ok,
        checkedAt: new Date().toISOString(),
        reason: data.reason,
        status: data.status,
        latencyMs: data.latencyMs,
        model: data.model,
      });
      if (data.ok) {
        message.success(t(successKey));
      } else {
        message.error(`${t(failKey)}: ${data.reason || data.status || ''}`);
      }
    },
    onError: () => {
      setHealth({ ok: false, checkedAt: new Date().toISOString(), reason: t('common.tryAgain') });
      message.error(t(failKey));
    },
  });

  return { health, setHealth, mutation };
};
