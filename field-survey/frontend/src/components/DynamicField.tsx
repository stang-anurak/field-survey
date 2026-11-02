import type { CustomValue, FormField } from '../types';

interface Props { field: FormField; value: CustomValue | undefined; error?: string; onChange: (v: CustomValue | undefined) => void }

export function DynamicField({ field: f, value, error, onChange }: Props) {
  const id = `f-${f.key}`;
  const label = <label htmlFor={id}>{f.label}{f.required && <span className="req"> *</span>}</label>;
  let input;
  switch (f.type) {
    case 'textarea': input = <textarea id={id} rows={4} value={(value as string) ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />; break;
    case 'number': input = <input id={id} type="number" inputMode="decimal" step="any" value={(value as string | number) ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />; break;
    case 'date': input = <input id={id} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />; break;
    case 'select':
      input = (<select id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">— เลือก —</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>); break;
    case 'multiselect': {
      const cur = (value as string[]) ?? [];
      input = (<div className="checks" role="group" aria-labelledby={id}>{f.options.map((o) => (
        <label key={o} className="check"><input type="checkbox" checked={cur.includes(o)} onChange={(e) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} />{o}</label>))}</div>); break;
    }
    case 'checkbox':
      return (<div className="field"><label className="check"><input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />{f.label}{f.required && <span className="req"> *</span>}</label>
        {f.helpText && <p className="hint">{f.helpText}</p>}{error && <p className="err" role="alert">{error}</p>}</div>);
    default: input = <input id={id} type="text" value={(value as string) ?? ''} placeholder={f.placeholder} maxLength={200} onChange={(e) => onChange(e.target.value)} />;
  }
  return (<div className={`field${error ? ' has-err' : ''}`}>{label}{input}{f.helpText && <p className="hint">{f.helpText}</p>}{error && <p className="err" role="alert">{error}</p>}</div>);
}
