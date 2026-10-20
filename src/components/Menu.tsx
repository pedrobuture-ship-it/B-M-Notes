import { useTr } from "@/lib/i18n";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface MenuEntry {
  label?: string;
  icon?: ReactNode;
  danger?: boolean;
  separator?: boolean;
  heading?: boolean;
  onSelect?: () => void;
  custom?: ReactNode;
}

interface MenuProps {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}

/** Floating context menu positioned at (x, y), kept inside the viewport. */
export function Menu({ x, y, entries, onClose }: MenuProps) {
  const tr = useTr();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y, entries]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", down, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button.menu-item")?.focus();
  }, []);

  return (
    <div ref={ref} className="menu" role="menu" style={pos} onContextMenu={(e) => e.preventDefault()}>
      {entries.map((e, i) =>
        e.separator ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : e.heading ? (
          <div key={i} className="menu-label">{e.label ? tr(e.label) : ""}</div>
        ) : e.custom ? (
          <div key={i} className="px-2 py-1">{e.custom}</div>
        ) : (
          <button
            key={i}
            className="menu-item"
            role="menuitem"
            data-danger={e.danger ? "true" : undefined}
            onClick={() => {
              onClose();
              e.onSelect?.();
            }}
            onKeyDown={(ev) => {
              const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button.menu-item") ?? [])];
              const at = items.indexOf(ev.currentTarget);
              if (ev.key === "ArrowDown") (items[(at + 1) % items.length])?.focus();
              if (ev.key === "ArrowUp") (items[(at - 1 + items.length) % items.length])?.focus();
            }}
          >
            {e.icon}
            {e.label ? tr(e.label) : ""}
          </button>
        ),
      )}
    </div>
  );
}

export interface MenuState {
  x: number;
  y: number;
  entries: MenuEntry[];
}

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const open = useCallback(
    (e: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation?: () => void }, entries: MenuEntry[]) => {
      e.preventDefault();
      e.stopPropagation?.();
      setMenu({ x: e.clientX, y: e.clientY, entries });
    },
    [],
  );
  const close = useCallback(() => setMenu(null), []);
  return { menu, open, close };
}
