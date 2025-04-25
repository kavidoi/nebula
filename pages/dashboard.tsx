import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useUser } from '@auth0/nextjs-auth0/client'
import { withPageAuthRequired } from '@auth0/nextjs-auth0'

type FormRecord = {
  formId: string
  username: string
  apiKey: string
  baseId: string
  tableName: string
  fields: any[]
  formTitle: string
  createdAt: string
  isActive: boolean
}

function Dashboard() {
  const router = useRouter()
  const { user, isLoading } = useUser()
  const handleLogout = () => { window.location.href = '/api/auth/logout' }
  const [forms, setForms] = useState<FormRecord[]>([])
  // Remove form with confirmation
  const handleDelete = async (formId: string) => {
    if (!user) return
    if (!window.confirm('Are you sure you want to delete this form?')) return
    try {
      await axios.delete(`/api/forms/${user.username}/${formId}`)
      setForms(prev => prev.filter(f => f.formId !== formId))
    } catch (e) {
      console.error(e)
      alert('Failed to delete form')
    }
  }

  useEffect(() => {
    if (!user) {
      router.push('/login')
    } else {
      axios
        .get<FormRecord[]>(`/api/forms?username=${user.username}`)
        .then(res => setForms(res.data))
        .catch(err => console.error(err))
    }
  }, [user, router])

  if (isLoading) return <div style={{ padding: 20 }}>Loading...</div>
  if (!user) return null

  const grouped = forms.reduce<Record<string, FormRecord[]>>((acc, f) => {
    if (!acc[f.tableName]) acc[f.tableName] = []
    acc[f.tableName].push(f)
    return acc
  }, {})

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span>Logged in as: {user.name || user.email}</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <h1>Dashboard</h1>
      <button onClick={() => router.push('/new')} style={{ marginBottom: 16 }}>
        + New Form
      </button>
      {Object.entries(grouped).map(([table, group]) => (
        <div key={table} style={{ marginTop: 24 }}>
          <h2>{table}</h2>
          <ul>
            {group.map(f => (
              <li key={f.formId} style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <a
                    href={`/${f.username}/${f.formId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontWeight: 'bold' }}
                  >
                    {f.formTitle}
                  </a>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>
                    {new Date(f.createdAt).toLocaleString()}
                  </span>
                </div>
                <button onClick={() => {
                  router.push({
                    pathname: '/builder',
                    query: { tableName: f.tableName, apiKey: f.apiKey, baseId: f.baseId }
                  })
                }}>
                  Use as Base
                </button>
                <button onClick={() => handleDelete(f.formId)} style={{ marginLeft: 8, color: 'red' }}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default Dashboard

export const getServerSideProps = withPageAuthRequired()
