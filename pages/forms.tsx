import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

type FormRecord = {
  formId: string
  username: string
  apiKey: string
  baseId: string
  tableName: string
  fields: any[]
  isActive: boolean
}

export default function MyForms() {
  const { user } = useAuth()
  const router = useRouter()
  const [forms, setForms] = useState<FormRecord[]>([])

  useEffect(() => {
    if (!user) {
      router.push('/login')
    } else {
      axios
        .get<FormRecord[]>(`/api/forms/${user.username}`)
        .then(res => setForms(res.data))
        .catch(err => console.error(err))
    }
  }, [user])

  if (!user) return null
  return (
    <div style={{ padding: 20 }}>
      <h2>My Forms</h2>
      {forms.length === 0 ? (
        <p>You haven't published any forms yet.</p>
      ) : (
        <ul>
          {forms.map(f => (
            <li key={f.formId} style={{ margin: '8px 0' }}>
              <a href={`/${f.username}/${f.formId}`} target="_blank" rel="noopener noreferrer">
                {f.tableName} ({f.formId})
              </a> - {f.isActive ? 'Active' : 'Inactive'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
