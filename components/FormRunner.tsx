import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { useQueries, useQuery } from '@tanstack/react-query'
import axios from 'axios'

interface FieldSettings {
  id: string
  name: string
  type: string
  options?: any
  include: boolean
  label: string
  placeholder: string
  defaultValue: any
  required: boolean
  numValues?: number
  showFormula?: boolean
}

interface Props {
  fields: FieldSettings[]
  linkedTables: { id: string; name: string }[]
  baseTableName: string
  apiKey?: string
  baseId?: string
}

export default function FormRunner({ fields, linkedTables, baseTableName, apiKey: apiKeyProp, baseId: baseIdProp }: Props) {
  const included = useMemo(() => fields.filter(f => f.include), [fields])
  const defaultValues = useMemo(() =>
    included.reduce((acc: Record<string, any>, f) => {
      acc[f.id] = f.defaultValue
      return acc
    }, {}),
    [included]
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<Record<string, any>>({ defaultValues })

  const defaultValuesRef = useRef<string>(JSON.stringify(defaultValues))
  useEffect(() => {
    const dv = JSON.stringify(defaultValues)
    if (dv !== defaultValuesRef.current) {
      defaultValuesRef.current = dv
      reset(defaultValues)
    }
  }, [defaultValues, reset])

  const { user } = useAuth()
  const apiKey = apiKeyProp ?? user?.apiKey
  const baseId = baseIdProp ?? user?.baseId
  const linkFields = fields.filter((f) =>
    ['singleRecordLink', 'multipleRecordLinks'].includes(f.type)
  )

  // memoize the queries config to prevent re-creation on every render
  const recordQueriesConfig = useMemo(
    () =>
      linkFields.map((f) => {
        const tn =
          linkedTables.find((lt) => lt.id === f.options.linkedTableId)
            ?.name || ''
        return {
          queryKey: ['records', tn],
          queryFn: async () => {
            const res = await axios.get('/api/records', {
              params: { tableName: tn },
              headers: { 'x-api-key': apiKey, 'x-base-id': baseId }
            })
            return res.data.records as any[]
          }
        }
      }),
    [linkFields, linkedTables, apiKey, baseId]
  )
  const recordQueries = useQueries({ queries: recordQueriesConfig })

  // build recordMap from memoized recordQueries
  const recordMap = useMemo(() => {
    const map: Record<string, any[]> = {}
    linkFields.forEach((f, i) => {
      map[f.id] = recordQueries[i]?.data || []
    })
    return map
  }, [linkFields, recordQueries])

  // Map record ID to first-column name for linked records (skip empty names)
  const recordNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    Object.values(recordMap)
      .flat()
      .forEach((r: any) => {
        const name = Object.values(r.fields)[0]
        if (name != null && name !== '') {
          m[r.id] = String(name)
        }
      })
    return m
  }, [recordMap])

  // memoize fetch function for all records
  const fetchAllRecords = useCallback(async () => {
    const res = await axios.get('/api/records', {
      params: { tableName: baseTableName },
      headers: { 'x-api-key': apiKey, 'x-base-id': baseId }
    })
    return res.data.records as any[]
  }, [baseTableName, apiKey, baseId])
  const allRecordsQuery = useQuery(
    ['allRecords', baseTableName],
    fetchAllRecords,
    { enabled: !!baseTableName }
  )

  const infoFields = useMemo(
    () => fields.filter(f => (f.type === 'formula' || f.type === 'rollup') && f.include),
    [fields]
  )

  const onSubmit = async (data: any) => {
    // Build fields payload, converting types as needed
    const fieldsPayload: Record<string, any> = {}
    included.forEach(f => {
      let value = data[f.id]
      // multipleRecordLinks: ensure array
      if (f.type === 'multipleRecordLinks') {
        if (typeof value === 'string') {
          value = value.split(',').map(s => s.trim()).filter(s => s)
        }
      }
      // numbers and currency: convert to number or skip if empty/invalid
      if (f.type === 'number' || f.type === 'currency') {
        const num = Number(value)
        if (isNaN(num)) {
          return
        }
        value = num
      }
      // skip empty strings
      if (value === '' || value == null) {
        return
      }
      fieldsPayload[f.id] = value
    })
    try {
      const res = await axios.post(
        '/api/records',
        fieldsPayload,
        { params: { tableName: baseTableName }, headers: { 'x-api-key': apiKey, 'x-base-id': baseId } }
      )
      const created = (res.data as any).record
      alert(`Record created: ${created.id ?? 'success'}`)
      reset()
    } catch (err: any) {
      console.error('Error creating record:', err.response?.data || err.message)
      alert(`Failed to submit form: ${err.response?.data?.error || err.message || 'unknown error'}`)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 20 }}>
        <h2>Form Preview</h2>
        {included.map((f) => (
          <div key={f.id} style={{ marginBottom: 16 }}>
            <label>{f.label}</label>
            <div>
              {f.type === 'singleRecordLink' ? (
                <select {...register(f.id, { required: f.required })}>
                  <option value="">Select record...</option>
                  {recordMap[f.id].map((r) => (
                    <option key={r.id} value={r.id}>
                      {recordNameMap[r.id] ?? ''}
                    </option>
                  ))}
                </select>
              ) : f.type === 'multipleRecordLinks' ? (
                <select multiple {...register(f.id, { required: f.required })}>
                  {recordMap[f.id].map((r) => (
                    <option key={r.id} value={r.id}>
                      {recordNameMap[r.id] ?? ''}
                    </option>
                  ))}
                </select>
              ) : f.type === 'singleSelect' ? (
                <select {...register(f.id, { required: f.required })}>
                  <option value="">Select...</option>
                  {f.options?.choices.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : f.type === 'multipleSelect' ? (
                <select multiple {...register(f.id, { required: f.required })}>
                  {f.options?.choices.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : f.type === 'currency' || f.type === 'number' ? (
                <input
                  type="number"
                  placeholder={f.placeholder}
                  {...register(f.id, { required: f.required })}
                />
              ) : f.type === 'date' ? (
                <input
                  type="date"
                  placeholder={f.placeholder}
                  {...register(f.id, { required: f.required })}
                />
              ) : f.type === 'button' ? (
                <button
                  type="button"
                  style={{
                    backgroundColor: f.placeholder || '#0070f3',
                    color: '#fff',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {f.defaultValue || f.label}
                </button>
              ) : (
                <input
                  type="text"
                  placeholder={f.placeholder}
                  {...register(f.id, { required: f.required })}
                />
              )}
            </div>
            {errors[f.id] && <p style={{ color: 'red' }}>{f.label} is required</p>}
          </div>
        ))}
        <button type="submit">Submit</button>
      </form>
      {infoFields.length > 0 && allRecordsQuery.data != null && (
        <div style={{ marginTop: 32, padding: 20, backgroundColor: '#111', borderRadius: 4 }}>
          <h3>Information</h3>
          {infoFields.map(f => {
            const values = (allRecordsQuery.data || []).map(r => r.fields[f.name]).filter(v => v != null)
            const num = f.numValues || 1
            const shown = values.slice(-num)
            return (
              <div key={f.id} style={{ marginBottom: 16 }}>
                <h4>{f.label}</h4>
                {f.showFormula && (
                  <pre style={{ backgroundColor: '#222', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
                    {f.type === 'formula'
                      ? f.options.formula
                      : `Rollup(${(f.options.rollup.fields || []).join(', ')} => ${f.options.rollup.function})`}
                  </pre>
                )}
                {shown.map((v, i) => {
                  let display: any
                  if (Array.isArray(v)) {
                    display = (v as any[])
                      .map(el => recordNameMap[el] ?? el)
                      .join(', ')
                  } else if (typeof v === 'string' && recordNameMap[v]) {
                    display = recordNameMap[v]
                  } else {
                    display = v
                  }
                  return (
                    <p key={i} style={{ margin: '4px 0' }}>
                      {display}
                    </p>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
