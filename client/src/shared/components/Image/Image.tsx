import type { ImgHTMLAttributes } from 'react'

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | { src: string; width?: number; height?: number }
  alt?: string
  fill?: boolean
  priority?: boolean
}

export default function Image({
  src,
  alt = '',
  fill = false,
  width,
  height,
  className = '',
  priority = false,
  style = {},
  ...props
}: ImageProps) {
  const imageSrc = typeof src === 'object' && src !== null ? src.src : src

  const combinedStyle = fill
    ? {
        position: 'absolute' as const,
        height: '100%',
        width: '100%',
        inset: 0,
        color: 'transparent',
        ...style,
      }
    : style

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? 'eager' : 'lazy'}
      className={className}
      style={combinedStyle}
      {...props}
    />
  )
}
