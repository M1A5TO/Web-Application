import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  id?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  cities: string[];
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (isValid: boolean) => void;
  maxSuggestions?: number;
};

function normalizeForSearch(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default function CityAutocomplete({
  id,
  label,
  placeholder,
  required,
  cities,
  value,
  onChange,
  onValidChange,
  maxSuggestions = 10,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalizedValue = useMemo(() => normalizeForSearch(value), [value]);

  const citySet = useMemo(() => new Set(cities), [cities]);
  const isValid = useMemo(() => citySet.has(value), [citySet, value]);

  useEffect(() => {
    onValidChange?.(isValid);
  }, [isValid, onValidChange]);

  const suggestions = useMemo(() => {
    const q = normalizedValue;
    if (!q) return cities.slice(0, maxSuggestions);

    const out: string[] = [];
    for (const c of cities) {
      if (normalizeForSearch(c).includes(q)) out.push(c);
      if (out.length >= maxSuggestions) break;
    }
    return out;
  }, [cities, maxSuggestions, normalizedValue]);

  const listId = useMemo(() => `${id || "city"}-listbox`, [id]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function commitSelection(next: string) {
    onChange(next);
    setOpen(false);
    setActiveIndex(-1);
    // keep focus in input
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => {
        const next = Math.min((suggestions.length || 1) - 1, i + 1);
        return Number.isFinite(next) ? next : -1;
      });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.max(-1, i - 1));
      return;
    }

    if (e.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        commitSelection(suggestions[activeIndex]);
        return;
      }

      // Mode A: block submit if the value isn't an exact city name.
      if (!isValid) {
        e.preventDefault();
        setOpen(true);
        // best-effort: jump to first suggestion
        setActiveIndex(suggestions.length > 0 ? 0 : -1);
        return;
      }
    }

    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      ) : null}

      <input
        ref={inputRef}
        id={id}
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={required && !isValid ? true : undefined}
        required={required}
        autoComplete="off"
      />

      {open && suggestions.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "rgba(15, 23, 42, 0.98)",
            border: "1px solid rgba(139,92,246,0.35)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 18px 50px rgba(0,0,0,.35)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {suggestions.map((c, idx) => {
            const active = idx === activeIndex;
            return (
              <div
                key={c}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  // prevent input blur
                  e.preventDefault();
                  commitSelection(c);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: active ? "white" : "rgba(229,231,235,0.88)",
                  background: active ? "rgba(139,92,246,0.22)" : "transparent",
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
      ) : null}

      {!isValid && value.trim().length > 0 ? (
        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
          Wybierz miasto z listy podpowiedzi.
        </div>
      ) : null}
    </div>
  );
}
