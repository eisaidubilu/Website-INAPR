import { cx, fieldLabel } from '@/lib/ui'

interface SearchFieldProps {
  id: string
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Input pencarian dengan label terlihat. Border memakai --muted supaya kontras ≥ 3:1.
 * `js-only`: disembunyikan bila JavaScript mati (lihat <noscript> di index.html).
 */
export function SearchField({ id, label, placeholder, value, onChange, className }: SearchFieldProps) {
  return (
    <div className={cx('js-only grid gap-1.5', className)}>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full min-w-0 rounded-md border border-muted bg-surface px-3 font-body text-base text-ink placeholder:text-muted"
      />
    </div>
  )
}
