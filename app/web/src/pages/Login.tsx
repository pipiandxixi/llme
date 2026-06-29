import { useState } from 'react'

interface Props {
  onLogin: () => void
}

const USERNAME = 'tester'
const PASSWORD = 'tester123'

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()

    if (username === USERNAME && password === PASSWORD) {
      setError('')
      onLogin()
      return
    }

    setError('用户名或密码错误')
  }

  return (
    <div className="h-full login-shell flex items-center justify-center px-6">
      <form onSubmit={submit} className="login-card w-full max-w-sm">
        <div className="login-eyebrow">llme Access</div>
        <h1 className="login-title">Sign In</h1>
        <p className="login-copy">使用测试账号进入当前工作台。</p>

        <label className="login-label">
          用户名
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="login-input"
            autoComplete="username"
          />
        </label>

        <label className="login-label">
          密码
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            autoComplete="current-password"
          />
        </label>

        {error ? <div className="login-error">{error}</div> : null}

        <button type="submit" className="login-submit">进入系统</button>
      </form>
    </div>
  )
}
