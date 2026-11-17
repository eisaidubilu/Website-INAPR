import { useEffect, useRef } from 'react'
import { cx } from '@/lib/ui'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedToggleProps<T extends string> {
  label: string
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * Grup tombol pilih-satu (fieldset + legend tersembunyi). Tiap tombol memakai aria-pressed.
 *
 * Indikator: satu "thumb" (lebar 1px, di-scaleX ke lebar tombol aktif) yang meluncur dengan
 * transform, dipotong pembungkus rounded-full. Sebelum JS menempatkannya (prerender/tanpa
 * JS), latar tombol aktif tetap dari aria-pressed, jadi tidak ada keadaan kosong.
 * Tekan: scale 0.97 (motion-safe). Tata letak tombol tidak berubah.
 */
export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedToggleProps<T>) {
  const groupRef = useRef<HTMLFieldSetElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)
  const labels = options.map((option) => option.label).join('|')

  useEffect(() => {
    const group = groupRef.current
    const thumb = thumbRef.current
    if (!group || !thumb) return
    const place = () => {
      const active = group.querySelector<HTMLElement>('button[aria-pressed="true"]')
      if (!active || active.offsetWidth === 0) return
      // Penempatan pertama tanpa animasi (tidak meluncur dari kiri).
      const instant = !placed.current
      if (instant) thumb.style.transition = 'none'
      thumb.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`
      if (instant) {
        void thumb.offsetWidth
        thumb.style.transition = ''
        placed.current = true
        group.dataset.ready = 'true'
      }
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(group)
    let alive = true
    document.fonts?.ready.then(() => {
      if (alive) place()
    })
    return () => {
      alive = false
      observer.disconnect()
    }
  }, [value, labels])

  return (
    <fieldset ref={groupRef} className={cx('group relative m-0 flex min-w-0 rounded-full border border-line p-0', className)}>
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span
          ref={thumbRef}
          className="absolute inset-y-0 left-0 w-px origin-left bg-accent opacity-0 transition-transform duration-200 ease-out group-data-[ready=true]:opacity-100"
        />
      </span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className="relative min-h-11 min-w-11 cursor-pointer px-2.5 font-body text-[0.7rem] font-semibold tracking-[0.08em] text-muted uppercase transition-[color,scale] duration-200 ease-out first-of-type:rounded-l-full last:rounded-r-full hover:text-ink aria-pressed:bg-accent aria-pressed:text-accent-ink group-data-[ready=true]:aria-pressed:bg-transparent motion-safe:active:scale-[0.97]"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  )
}
