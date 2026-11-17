import type { ReactNode } from 'react'
import { cx } from '@/lib/ui'

interface ContainerProps {
  children: ReactNode
  className?: string
  /** Navbar memakai lebar lebih besar supaya menu muat satu baris di desktop. */
  wide?: boolean
}

/** Pembungkus lebar konten. Gutter 16px di mobile, 24px mulai md. */
export function Container({ children, className, wide = false }: ContainerProps) {
  return (
    <div
      className={cx(
        'mx-auto w-full px-4 md:px-6',
        wide ? 'max-w-[1360px]' : 'max-w-[1200px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
