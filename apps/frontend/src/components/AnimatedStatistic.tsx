import { Statistic } from 'antd';
import type { StatisticProps } from 'antd';
import { CountUpNumber } from './CountUpNumber';

type AnimatedStatisticProps = StatisticProps & {
  duration?: number;
  decimals?: number;
};

export const AnimatedStatistic = ({ value, duration, decimals, formatter, ...rest }: AnimatedStatisticProps) => {
  if (formatter) {
    return <Statistic value={value} formatter={formatter} {...rest} />;
  }

  return (
    <Statistic
      value={value}
      formatter={(raw) => {
        const numeric = typeof raw === 'number' ? raw : Number(raw);
        return <CountUpNumber value={Number.isFinite(numeric) ? numeric : null} duration={duration} decimals={decimals} />;
      }}
      {...rest}
    />
  );
};
