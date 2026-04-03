import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Alert as AntAlert, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../../../i18n';
import {
  getQueueMetrics,
  getQueueAlerts,
  getWorkerHealth,
  getQueueTrends,
} from '../../../api/admin';
import QueueStatus from './QueueStatus';
import FailedJobs from './FailedJobs';
import WorkerHealth from './WorkerHealth';
import QueueTrends from './QueueTrends';

export default function QueueMonitoring() {
  const { t } = useI18n();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['queue-metrics', refreshKey],
    queryFn: () => getQueueMetrics({ queue: 'grading' }),
    refetchInterval: 5000,
  });

  const { data: alerts } = useQuery({
    queryKey: ['queue-alerts', refreshKey],
    queryFn: getQueueAlerts,
    refetchInterval: 10000,
  });

  const { data: workerHealth } = useQuery({
    queryKey: ['worker-health', refreshKey],
    queryFn: getWorkerHealth,
    refetchInterval: 10000,
  });

  const { data: trends } = useQuery({
    queryKey: ['queue-trends'],
    queryFn: () => getQueueTrends(7),
    refetchInterval: 60000,
  });

  const hasAlerts = alerts && alerts.some(a => a.active);

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={16} align="middle" style={{ marginBottom: 24 }}>
        <Col flex="auto">
          <h1>{t('admin.queue.monitoring')}</h1>
        </Col>
        <Col>
          <ReloadOutlined
            onClick={() => setRefreshKey(k => k + 1)}
            style={{ fontSize: 20, cursor: 'pointer' }}
          />
        </Col>
      </Row>

      {hasAlerts && alerts?.map(alert => (
        alert.active && (
          <AntAlert
            key={alert.type}
            message={alert.message}
            type="warning"
            showIcon
            closable
            style={{ marginBottom: 16 }}
          />
        )
      ))}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title={t('status.queued')}
              value={metrics?.waiting || 0}
              valueStyle={{ color: metrics?.waiting > 100 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title={t('status.processing')}
              value={metrics?.active || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title={t('status.done')}
              value={metrics?.completed || 0}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={metricsLoading}>
            <Statistic
              title={t('status.failed')}
              value={metrics?.failed || 0}
              valueStyle={{ color: metrics?.failed > 10 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <QueueStatus metrics={metrics} />
        </Col>
        <Col span={12}>
          <WorkerHealth health={workerHealth} />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <FailedJobs />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <QueueTrends trends={trends} />
        </Col>
      </Row>
    </div>
  );
}
