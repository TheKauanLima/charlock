import type { CSSProperties } from 'react'

export type SquareIconSize = 'tiny' | 'small' | 'medium' | 'large'

export interface SquareIconSizeOption {
  id: SquareIconSize
  label: string
  token: `square:${SquareIconSize}`
  previewSize: string
  renderSize: string
  statSize: string
  swatchSize: string
}

export const SQUARE_ICON_SIZE_OPTIONS: SquareIconSizeOption[] = [
  { id: 'tiny', label: 'Tiny', token: 'square:tiny', previewSize: '18px', renderSize: '34%', statSize: '10px', swatchSize: '9px' },
  { id: 'small', label: 'Small', token: 'square:small', previewSize: '30px', renderSize: '48%', statSize: '14px', swatchSize: '14px' },
  { id: 'medium', label: 'Medium', token: 'square:medium', previewSize: '42px', renderSize: '62%', statSize: '18px', swatchSize: '20px' },
  { id: 'large', label: 'Large', token: 'square:large', previewSize: '56px', renderSize: '78%', statSize: '22px', swatchSize: '26px' },
]

export const DEFAULT_SQUARE_ICON_SIZE: SquareIconSize = 'medium'

export function isSquareIcon(icon: string | null | undefined): icon is `square:${SquareIconSize}` {
  return icon === 'square:tiny' || icon === 'square:small' || icon === 'square:medium' || icon === 'square:large'
}

export function getSquareIconOption(sizeOrToken: SquareIconSize | `square:${SquareIconSize}` | string | null | undefined) {
  const size = isSquareIcon(sizeOrToken)
    ? sizeOrToken.replace('square:', '')
    : sizeOrToken
  return SQUARE_ICON_SIZE_OPTIONS.find(option => option.id === size) ?? SQUARE_ICON_SIZE_OPTIONS.find(option => option.id === DEFAULT_SQUARE_ICON_SIZE)!
}

export function getSquareIconToken(size: SquareIconSize): `square:${SquareIconSize}` {
  return getSquareIconOption(size).token
}

export function getSquareIconStyle(icon: string, color = '#fff8ec', mode: 'ability' | 'stat' = 'ability'): CSSProperties {
  const option = getSquareIconOption(icon)
  const size = mode === 'stat' ? option.statSize : option.renderSize

  return {
    width: size,
    height: size,
    backgroundColor: color || '#fff8ec',
    WebkitMaskImage: 'none',
    maskImage: 'none',
  }
}
