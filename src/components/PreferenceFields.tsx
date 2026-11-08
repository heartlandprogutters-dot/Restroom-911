import type { AccessibilityPreferences, PreferenceLevel } from '../domain/types';

const FIELDS: { key: keyof AccessibilityPreferences; label: string }[] = [
  { key: 'wheelchair', label: 'Wheelchair accessible' },
  { key: 'singleUser', label: 'Single-user or family restroom' },
  { key: 'changingTable', label: 'Changing table' },
  { key: 'genderNeutral', label: 'Gender-neutral restroom' },
];

const LEVELS: PreferenceLevel[] = ['off', 'preferred', 'required'];

export function PreferenceFields({
  value,
  onChange,
}: {
  value: AccessibilityPreferences;
  onChange: (key: keyof AccessibilityPreferences, level: PreferenceLevel) => void;
}) {
  return (
    <div className="stack">
      {FIELDS.map((field) => (
        <fieldset key={field.key} className="stack-tight">
          <legend>{field.label}</legend>
          <div className="seg" role="radiogroup" aria-label={field.label}>
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={value[field.key] === level}
                data-testid={`pref-${field.key}-${level}`}
                onClick={() => onChange(field.key, level)}
              >
                {level === 'off' ? 'Off' : level === 'preferred' ? 'Preferred' : 'Required'}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
