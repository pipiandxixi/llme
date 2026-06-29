import type { ProfileMeta } from '../types'
import { getProfileAvatarUrl } from '../api'
import ProfileAvatar from './ProfileAvatar'

interface Props {
  profile: ProfileMeta
  onClick: () => void
}

export default function ProfileCard({ profile, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-all flex items-start gap-3"
    >
      <ProfileAvatar
        name={profile.name}
        src={getProfileAvatarUrl(profile)}
        sizeClassName="w-10 h-10 text-base shrink-0 mt-0.5"
        initialClassName=""
      />
      <div className="min-w-0">
        <div className="text-white text-sm font-medium truncate">{profile.name}</div>
        <div className="text-zinc-400 text-xs mt-0.5 leading-relaxed line-clamp-2">{profile.description}</div>
      </div>
    </button>
  )
}
