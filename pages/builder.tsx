import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import FormBuilder from '../components/FormBuilder'

export default function Builder() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { apiKey, baseId, tableName } = router.query

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  useEffect(() => {
    if (user && (!apiKey || !baseId || !tableName)) {
      router.push('/')
    }
  }, [user, apiKey, baseId, tableName, router])

  if (!user || !apiKey || !baseId || !tableName) return null

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span>Logged in as: {user.username}</span>
        <button onClick={() => { logout(); router.push('/login') }}>Logout</button>
      </div>
      <FormBuilder
        key={String(tableName)}
        apiKey={String(apiKey)}
        baseId={String(baseId)}
        tableName={String(tableName)}
      />
    </>
  )
}
