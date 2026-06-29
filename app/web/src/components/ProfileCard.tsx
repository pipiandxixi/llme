import type { ProfileMeta } from '../types'

const AVATAR_COLORS = ['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-orange-500', 'bg-rose-600']

function getAvatarColor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface Props {
  profile: ProfileMeta
  onClick: () => void
}

export default function ProfileCard({ profile, onClick }: Props) {
  const avatarColor = getAvatarColor(profile.id)
  const initial = profile.name.charAt(0).toUpperCase()

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-all flex items-start gap-3"
    >
      <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-base shrink-0 mt-0.5`}>
        {initial}
      </div>
      <div className="min-w-0">
        <div className="text-white text-sm font-medium truncate">{profile.name}</div>
        <div className="text-zinc-400 text-xs mt-0.5 leading-relaxed line-clamp-2">{profile.description}</div>
      </div>
    </button>
  )
}
