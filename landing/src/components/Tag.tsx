import type { ReactNode } from 'react'

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-soft px-2.5 py-0.5 font-body text-[0.68rem] font-semibold tracking-[0.08em] text-accent uppercase">
      {children}
    </span>
  )
}
