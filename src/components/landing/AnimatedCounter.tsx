import { useEffect, useState } from 'react';
import { useReveal } from '@/hooks/useReveal';

interface Props {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export const AnimatedCounter = ({ end, duration = 1800, prefix = '', suffix = '' }: Props) => {
  const { ref, visible } = useReveal();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.floor(end * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, end, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString('pt-BR')}
      {suffix}
    </span>
  );
};
