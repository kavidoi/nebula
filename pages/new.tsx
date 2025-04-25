import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

export type FormRecord = {
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

export default function NewFormPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tables, setTables] = useState<string[]>([])
  const [forms, setForms] = useState<FormRecord[]>([])
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    // fetch available tables
    axios
      .get<{ tables: string[] }>('/api/tables', {
        headers: { 'x-api-key': user.apiKey, 'x-base-id': user.baseId }
      })
      .then(res => setTables(res.data.tables))
      .catch(err => setError(err.response?.data?.error || err.message))
    // fetch existing forms
    axios
      .get<FormRecord[]>('/api/forms', { params: { username: user.username } })
      .then(res => setForms(res.data))
      .catch(err => console.error(err))
  }, [user, router])

  if (!user) return null

  const grouped = forms.reduce<Record<string, FormRecord[]>>((acc, f) => {
    if (!acc[f.tableName]) acc[f.tableName] = []
    acc[f.tableName].push(f)
    return acc
  }, {})

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => router.push('/dashboard')} style={{ marginBottom: 16 }}>
        &larr; Back to Dashboard
      </button>
      <h1>New Form</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <section style={{ marginTop: 24 }}>
        <h2>Use Existing Form as Base</h2>
        {forms.length > 0 ? (
          Object.entries(grouped).map(([table, list]) => (
            <div key={table} style={{ marginBottom: 16 }}>
              <h3>{table}</h3>
              <ul>
                {list.map(f => (
                  <li key={f.formId} style={{ margin: '4px 0' }}>
                    <button
                      onClick={() =>
                        router.push({
                          pathname: '/builder',
                          query: { tableName: f.tableName, apiKey: user.apiKey, baseId: user.baseId }
                        })
                      }
                    >
                      {`${f.formTitle} (${new Date(f.createdAt).toLocaleString()})`}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p>No existing forms</p>
        )}
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Create New Form from Table</h2>
        {tables.length > 0 ? (
          <ul>
            {tables.map(t => (
              <li key={t} style={{ margin: '4px 0' }}>
                <button
                  onClick={() =>
                    router.push({
                      pathname: '/builder',
                      query: { tableName: t, apiKey: user.apiKey, baseId: user.baseId }
                    })
                  }
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading tables...</p>
        )}
      </section>
    </div>
  )
}
