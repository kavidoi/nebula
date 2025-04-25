import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useUser } from '@auth0/nextjs-auth0/client'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useUser()

  useEffect(() => {
    if (user) router.replace('/dashboard')
  }, [user, router])

  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }
  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Welcome to Nebula</h1>
        <p>Please <Link href="/login">Login</Link> or <Link href="/register">Register</Link>.</p>
      </div>
    )
  }

  return null
}
