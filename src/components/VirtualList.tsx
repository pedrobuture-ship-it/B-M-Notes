import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props<T> {
  items: T[];
  rowHeight: number;
  overscan?: number;
  render: (item: T, index: number) => ReactNode;
  className?: string;
}

/** Fixed-row-height windowing: only the rows in view (plus overscan) are mounted. */
export function VirtualList<T>({ items, rowHeight, overscan = 10, render, className }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(el.clientHeight);
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((top + height) / rowHeight) + overscan);
  return (
    <div ref={ref} className={className} style={{ overflow: "auto", flex: 1, minHeight: 0 }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: start * rowHeight, left: 0, right: 0 }}>
          {items.slice(start, end).map((it, i) => render(it, start + i))}
        </div>
      </div>
    </div>
  );
}
