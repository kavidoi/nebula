import { useRouter } from 'next/router'

export default function Login() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Login</h1>
      <a href="/api/auth/login">
        <button>Log In with Auth0</button>
      </a>
    </div>
  )
}
