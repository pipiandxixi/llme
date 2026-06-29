import type { ProfileMeta } from '../types'
import ProfileCard from '../components/ProfileCard'

interface Props {
  profiles: ProfileMeta[]
  onSelect: (profile: ProfileMeta) => void
}

export default function ProfileSelect({ profiles, onSelect }: Props) {
  return (
    <div className="h-full bg-zinc-950 flex flex-col">
      <header className="px-8 pt-12 pb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">llme</h1>
        <p className="text-zinc-400 text-sm mt-1">选择一个数字克隆开始对话</p>
      </header>

      {profiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-sm">暂无可用 Profile</p>
        </div>
      ) : (
        <div className="px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} onClick={() => onSelect(p)} />
          ))}
        </div>
      )}
    </div>
  )
}
