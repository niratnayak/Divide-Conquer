import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

/**
 * Chip-style list input: type a value and press Enter (or a comma) to add it.
 * Backspace on an empty box removes the last chip.
 * `suggestions` are shown as one-click "+ Skill" chips (e.g. skills found in the resume).
 */
export default function TagInput({
  label,
  values = [],
  onChange,
  placeholder,
  hint,
  suggestions = [],
  suggestionLabel,
  max = 30,
  maxTagLength = 200,
  onlyEnter = false,
}) {
  const [draft, setDraft] = useState('');
  const has = (v) => values.some((x) => x.toLowerCase() === v.toLowerCase());

  const add = (raw) => {
    if (!raw) return;
    const items = onlyEnter
      ? [String(raw).trim()]
      : String(raw).split(',').map((s) => s.trim());

    const clean = items
      .map((s) => s.slice(0, maxTagLength))
      .filter(Boolean);

    if (!clean.length) return;

    const current = Array.isArray(values) ? values : [];
    const next = [...current];

    for (const p of clean) {
      if (next.length >= max) break;
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) {
        next.push(p);
      }
    }

    if (next.length !== current.length) {
      onChange(next);
    }
    setDraft('');
  };

  const remove = (v) => onChange(values.filter((x) => x !== v));

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || (!onlyEnter && e.key === ',')) {
      e.preventDefault();
      if (draft.trim()) {
        add(draft);
      }
    } else if (e.key === 'Backspace' && !draft && values.length) {
      remove(values[values.length - 1]);
    }
  };

  const open = suggestions.filter((s) => !has(s));

  return (
    <div className="tag-input-field">
      <label>{label}</label>
      <div className="tag-input-box" onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
        {values.map((v) => (
          <span className="chip" key={v}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => remove(v)}><X size={12} /></button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={values.length ? '' : placeholder}
          onChange={(e) => {
            const val = e.target.value;
            if (!onlyEnter && val.includes(',')) {
              add(val);
            } else {
              setDraft(val);
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          disabled={values.length >= max}
        />
      </div>
      {hint && <small className="field-hint">{hint}</small>}
      {open.length > 0 && (
        <div className="chip-suggestions">
          <small>{suggestionLabel}</small>
          {open.map((s) => (
            <button type="button" className="chip-suggest" key={s} onClick={() => add(s)}>
              <Plus size={11} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
