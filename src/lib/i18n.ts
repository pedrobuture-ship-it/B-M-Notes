import { useCallback } from "react";
import { useSettings } from "@/stores/settings";
import { PT_BR } from "./locales/pt-BR";

export type LangSetting = "auto" | "en" | "pt-BR";
export type Lang = "en" | "pt-BR";

export const LANGUAGES: { id: LangSetting; label: string }[] = [
  { id: "auto", label: "Automatic (system)" },
  { id: "en", label: "English" },
  { id: "pt-BR", label: "Português (Brasil)" },
];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, "pt-BR": PT_BR };

/** The language to use for a setting; "auto" follows the browser/system language. */
export function resolveLang(setting: LangSetting, navigatorLang = typeof navigator !== "undefined" ? navigator.language : "en"): Lang {
  if (setting === "en" || setting === "pt-BR") return setting;
  return navigatorLang.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

/** English text is the key. Unknown keys fall back to English. `{name}` placeholders are filled from `vars`. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const text = DICTS[lang][key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all)) : text;
}

export type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** React hook: a translate function that re-renders the component when the language changes. */
export function useTr(): Tr {
  const setting = useSettings((s) => s.settings.appearance.language);
  const lang = resolveLang(setting);
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

/** For code outside React (toasts, dialogs opened from stores). */
export function tr(key: string, vars?: Record<string, string | number>): string {
  return translate(resolveLang(useSettings.getState().settings.appearance.language), key, vars);
}
