import type { ReactNode } from "react";
import { useTr } from "@/lib/i18n";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />;
}

export function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const tr = useTr();
  return (
    <div className="setting-row">
      <div><div>{tr(title)}</div>{hint && <small>{tr(hint)}</small>}</div>
      {children}
    </div>
  );
}
