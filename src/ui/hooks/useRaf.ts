import { useEffect, useRef } from 'react';

/** Runs `cb(dtMs)` on every animation frame while mounted. The latest callback is always used. */
export function useRaf(cb: (dt: number) => void, active = true): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      ref.current(now - last);
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}
