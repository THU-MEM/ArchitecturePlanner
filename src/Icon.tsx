import type { ButtonHTMLAttributes } from 'react'
import type { IconReference } from './icons.ts'
import { uiIcon } from './icons.ts'

export default function Icon({ icon, decorative = false, loading }: { icon: IconReference; decorative?: boolean; loading?: 'lazy' | 'eager' }) {
  return <img className={`icon ${icon.brand ? 'brand-icon' : 'glyph-icon'}`} src={`${import.meta.env.BASE_URL}${icon.src}`} alt={decorative ? '' : icon.label} aria-hidden={decorative || undefined} loading={loading} decoding={loading === 'lazy' ? 'async' : undefined} />
}

export function IconButton({ icon, label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }) {
  return <button type="button" {...props} className={`icon-button ${className}`} aria-label={label} title={label}><Icon icon={uiIcon(icon)} decorative /></button>
}
