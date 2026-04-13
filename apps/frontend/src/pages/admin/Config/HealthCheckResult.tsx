import { Space, Tag, Typography } from 'antd';
import { useI18n } from '../../../i18n';
import { formatDate } from '../../../utils/dateFormat';
import type { HealthState } from './types';

interface HealthCheckResultProps {
  health: HealthState | null;
  successLabel: string;
  failLabel: string;
}

export const HealthCheckResult = ({ health, successLabel, failLabel }: HealthCheckResultProps) => {
  const { t } = useI18n();

  if (!health) return null;

  return (
    <Space size={8} style={{ marginTop: 8 }} wrap>
      <Tag color={health.ok ? 'green' : 'red'}>
        {health.ok ? successLabel : failLabel}
      </Tag>
      <Typography.Text type="secondary">
        {t('admin.config.lastChecked')} {formatDate(health.checkedAt)}
      </Typography.Text>
      {health.model ? (
        <Typography.Text type="secondary">{health.model}</Typography.Text>
      ) : null}
      {typeof health.latencyMs === 'number' ? (
        <Typography.Text type="secondary">{health.latencyMs}ms</Typography.Text>
      ) : null}
      {!health.ok && health.reason ? (
        <Typography.Text type="secondary">{health.reason}</Typography.Text>
      ) : null}
    </Space>
  );
};
