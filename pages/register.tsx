import { useRouter } from 'next/router'

// Removed custom hooks; using Auth0 SDK for signup

export default function Register() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Register</h1>
      <a href="/api/auth/login?screen_hint=signup">
        <button>Sign Up with Auth0</button>
      </a>
    </div>
  )
}
