import { useEffect, useRef, useState } from 'react';

type CountUpNumberProps = {
  value?: number | null;
  duration?: number;
  decimals?: number;
  format?: (value: number) => string;
  suffix?: string;
  prefix?: string;
  className?: string;
};

export const CountUpNumber = ({
  value,
  duration = 900,
  decimals,
  format,
  suffix,
  prefix,
  className,
}: CountUpNumberProps) => {
  const [display, setDisplay] = useState<number | null>(
    typeof value === 'number' && !Number.isNaN(value) ? value : null,
  );
  const frameRef = useRef<number | null>(null);
  const displayRef = useRef<number>(0);
  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    const target = typeof value === 'number' && !Number.isNaN(value) ? value : null;
    targetRef.current = target;

    if (target === null) {
      setDisplay(null);
      displayRef.current = 0;
      return undefined;
    }

    const from = Number.isFinite(displayRef.current) ? displayRef.current : 0;

    if (from === target || duration <= 0) {
      setDisplay(target);
      displayRef.current = target;
      return undefined;
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [duration, value]);

  const formatValue = (raw: number) => {
    if (format) {
      return format(raw);
    }
    if (typeof decimals === 'number') {
      return raw.toFixed(decimals);
    }
    if (Number.isInteger(raw)) {
      return raw.toLocaleString();
    }
    return raw.toFixed(1);
  };

  if (display === null || targetRef.current === null) {
    return <span className={className}>--</span>;
  }

  return (
    <span className={className}>
      {prefix}
      {formatValue(display)}
      {suffix}
    </span>
  );
};
