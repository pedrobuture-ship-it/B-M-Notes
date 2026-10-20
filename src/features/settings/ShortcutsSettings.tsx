import { useEffect, useState } from "react";
import { ACTIONS, comboFromEvent, effectiveCombos, findConflict, formatCombo, isValidCombo, type ActionId } from "@/lib/shortcuts";
import { useSettings } from "@/stores/settings";

/** Rebind the app-wide shortcuts: click one, press the new keys. Esc cancels. Conflicts are refused. */
export function ShortcutsSettings() {
  const overrides = useSettings((s) => s.settings.shortcuts);
  const update = useSettings((s) => s.update);
  const [capturing, setCapturing] = useState<ActionId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const eff = effectiveCombos(overrides);

  const set = (id: ActionId, combo: string | null) =>
    update((s) => {
      const next = { ...s.shortcuts };
      const def = ACTIONS.find((a) => a.id === id)!.default;
      if (combo === null || combo === def) delete next[id];
      else next[id] = combo;
      return { ...s, shortcuts: next };
    });

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      // Handled here only: the global shortcut handler must not see the keys being recorded.
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setCapturing(null);
      const combo = comboFromEvent(e);
      if (!combo) return;
      if (!isValidCombo(combo)) return setMessage("Use Ctrl or Alt together with another key.");
      const clash = findConflict(overrides, capturing, combo);
      if (clash) return setMessage(`${formatCombo(combo)} is already used by “${clash.label}”.`);
      set(capturing, combo);
      setMessage(null);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, overrides]);

  return (
    <div className="px-5 pb-3">
      <div className="handwritten-label" style={{ fontSize: "1.4rem" }}>Rebind shortcuts</div>
      {message && <p role="alert" style={{ color: "var(--red)", fontWeight: 700, margin: "4px 0" }}>{message}</p>}
      {ACTIONS.map((a) => (
        <div key={a.id} className="shortcut-row" style={{ alignItems: "center", gap: 8 }}>
          <span className="flex-1">{a.label}</span>
          <button className="btn" aria-pressed={capturing === a.id} onClick={() => { setMessage(null); setCapturing(capturing === a.id ? null : a.id); }}>
            {capturing === a.id ? "Press keys… (Esc cancels)" : formatCombo(eff[a.id])}
          </button>
          <button className="btn btn-ghost" disabled={overrides[a.id] === undefined} onClick={() => set(a.id, null)} aria-label={`Reset ${a.label}`}>Reset</button>
        </div>
      ))}
    </div>
  );
}
