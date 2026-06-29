import { useState } from 'react'

interface Props {
  name: string
  src?: string
  sizeClassName: string
  initialClassName: string
}

export default function ProfileAvatar({ name, src, sizeClassName, initialClassName }: Props) {
  const initial = name.charAt(0).toUpperCase()
  const [broken, setBroken] = useState(false)

  if (!src || broken) {
    return <span className={`avatar ${sizeClassName} ${initialClassName}`}>{initial}</span>
  }

  return (
    <span className={`avatar ${sizeClassName} overflow-hidden ${initialClassName}`}>
      <img
        src={src}
        alt={name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </span>
  )
}
