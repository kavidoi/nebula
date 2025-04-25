import React, { useState, useEffect, Fragment, useReducer, useCallback } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import FormRunner from './FormRunner'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/router'

interface FieldMeta { id: string; name: string; type: string; options?: any }
interface FieldSettings extends FieldMeta { include: boolean; label: string; placeholder: string; defaultValue: any; required: boolean; showFormula?: boolean; numValues?: number }
interface BuilderFormValues { fields: FieldSettings[] }
interface Props { apiKey: string; baseId: string; tableName: string }

// Humanize field type names (e.g. 'singleLineText' -> 'Single line text')
function formatFieldType(type: string): string {
  const words = type.replace(/([A-Z])/g, ' $1').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export default function FormBuilder({ apiKey, baseId, tableName }: Props) {
  const { control, register } = useForm<BuilderFormValues>({ defaultValues: { fields: [] } })
  const { fields, append, move } = useFieldArray({ name: 'fields', control })
  const schemaQuery = useQuery(['schema', tableName], () =>
    axios
      .get('/api/schema', { params: { tableName }, headers: { 'x-api-key': apiKey, 'x-base-id': baseId } })
      .then(res => res.data)
  )

  useEffect(() => {
    if (schemaQuery.data?.fields && fields.length === 0) {
      schemaQuery.data.fields.forEach((f: FieldMeta) => {
        // default no field selected for preview
        append({
          ...f,
          include: false,
          label: f.name,
          placeholder: '',
          defaultValue: '',
          required: false,
          showFormula: false,
          numValues: 1
        })
      })
    }
  }, [schemaQuery.data, append, fields.length])

  const watchFields = useWatch({ name: 'fields', control })

  // fetch records for info preview in builder
  const recordsQuery = useQuery(
    ['builderRecords', tableName],
    () =>
      axios
        .get('/api/records', {
          params: { tableName },
          headers: { 'x-api-key': apiKey, 'x-base-id': baseId }
        })
        .then(res => res.data.records as any[]),
    { enabled: !!tableName }
  )

  const inputFields = fields.filter(f => f.type !== 'formula' && f.type !== 'rollup')
  const infoFields = fields.filter(f => f.type === 'formula' || f.type === 'rollup')

  const [previewKey, setPreviewKey] = useState(0)
  const [expandedInfo, setExpandedInfo] = useState<Record<string, boolean>>({})
  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({})
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editingTable, setEditingTable] = useState<boolean>(false)

  const { user } = useAuth()  // get current user for publish
  const [publishLink, setPublishLink] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  // Default form title logic
  const username = user?.username ?? ''
  const formsQuery = useQuery(
    ['myForms', username],
    () => axios.get(`/api/forms/${username}`).then(res => res.data as any[]),
    { enabled: !!user }
  )
  const [formTitle, setFormTitle] = useState(`Nebula ${tableName}`)
  useEffect(() => {
    if (formsQuery.isSuccess) {
      const count = formsQuery.data.filter((f: any) => f.tableName === tableName).length
      setFormTitle(count === 0 ? `Nebula ${tableName}` : `${tableName} ${count + 1}`)
    }
  }, [formsQuery.isSuccess, formsQuery.data, tableName])

  // handler to publish form definition
  async function handlePublish() {
    if (!user) return
    setPublishing(true)
    try {
      const res = await axios.post('/api/forms', {
        username: user.username,
        apiKey,
        baseId,
        tableName,
        fields: watchFields,
        formTitle
      })
      const { formId } = res.data
      setPublishLink(`${window.location.origin}/${user.username}/${formId}`)
    } catch (e) {
      console.error(e)
      alert('Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  // Schema editor state
  const [newTableName, setNewTableName] = useState<string | undefined>(undefined)
  const [fieldRenames, setFieldRenames] = useState<Record<string, string>>({})
  const [updatingSchema, setUpdatingSchema] = useState(false)
  const router = useRouter()

  // Initialize editor fields when schema loads
  useEffect(() => {
    if (schemaQuery.data) {
      setNewTableName(schemaQuery.data.name)
      const init: Record<string, string> = {}
      schemaQuery.data.fields.forEach((f: any) => { init[f.id] = f.name })
      setFieldRenames(init)
    }
  }, [schemaQuery.data])

  // Handler to apply schema changes
  async function handleSchemaUpdate() {
    console.log('Schema update payload:', { tableId: schemaQuery.data?.id, newTableName, fieldRenames })
    if (!schemaQuery.data) return
    setUpdatingSchema(true)
    try {
      const body: any = { tableId: schemaQuery.data.id }
      const renames = Object.entries(fieldRenames).reduce<any[]>((acc, [id, name]) => {
        const orig = schemaQuery.data.fields.find((f: any) => f.id === id)?.name
        if (orig && orig !== name) acc.push({ id, name })
        return acc
      }, [])
      if (renames.length) body.fieldRenames = renames
      if (body.fieldRenames) {
        // Apply updates
        const res = await axios.patch('/api/schema', body, { headers: { 'x-api-key': apiKey, 'x-base-id': baseId } })
        console.log('Schema update response:', res.data)
        alert(`Schema updated successfully: ${res.data.name}`)
        // If table was renamed, clear home cache and reload builder for new tableName
        if (body.fieldRenames) {
          // Only field renames, refetch schema
          const updated = await schemaQuery.refetch()
          console.log('Schema refetched:', updated.data)
        }
      }
    } catch (e: any) {
      console.error('Schema update error:', e.response?.data || e.message)
      alert(`Failed to update schema: ${e.response?.data?.error || e.message}`)
    } finally {
      setUpdatingSchema(false)
    }
  }

  // Separate handler for inline table rename
  async function handleTableRename(name: string) {
    console.log('Table rename payload:', name)
    if (!schemaQuery.data) return;
    setUpdatingSchema(true);
    try {
      const res = await axios.patch(
        '/api/schema',
        { tableId: schemaQuery.data.id, newTableName: name },
        { headers: { 'x-api-key': apiKey, 'x-base-id': baseId } }
      );
      setNewTableName(res.data.name);
      alert(`Table renamed to ${res.data.name}`);
      window.sessionStorage.removeItem('tables');
      await router.replace({ pathname: router.pathname, query: { apiKey, baseId, tableName: res.data.name } });
    } catch (error: any) {
      console.error('Table rename error:', error.response?.data || error.message);
      alert(`Failed to rename table: ${error.response?.data?.error || error.message}`);
    } finally {
      setUpdatingSchema(false);
    }
  }

  if (schemaQuery.isLoading) return <p>Loading schema...</p>
  if (schemaQuery.error) return <p>Error loading schema</p>

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, borderRight: '1px solid #ccc' }}>
        <button onClick={() => window.history.back()}>◀ Back</button>
        <div style={{ margin: '16px 0' }}>
          <input
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Form title"
            style={{ fontSize: '1.5em', fontWeight: 'bold', width: '100%', border: 'none', borderBottom: '1px solid #ccc', marginBottom: '4px' }}
          />
          <div style={{ fontSize: '0.9em', color: '#666' }}>
            Linked to table: {tableName}
          </div>
        </div>
        <h3>Form Fields</h3>
        {inputFields.map((field, idx) => {
          const index = fields.findIndex(f => f.id === field.id)
          return (
            <div key={field.id} style={{ borderBottom: '1px solid #ccc', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button>
                <button disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>↓</button>
                <input type="checkbox" {...register(`fields.${index}.include`)} style={{ marginLeft: 8 }} />
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}
                  onClick={() => setSettingsOpen(prev => ({ ...prev, [field.id]: !prev[field.id] }))}
                >
                  ⚙
                </button>
                <div style={{ marginLeft: 8 }}>
                  {editingFieldId === field.id ? (
                    <input
                      type="text"
                      value={fieldRenames[field.id] ?? field.name}
                      onChange={e => setFieldRenames(prev => ({ ...prev, [field.id]: e.target.value }))}
                      onBlur={() => { handleSchemaUpdate(); setEditingFieldId(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') { handleSchemaUpdate(); setEditingFieldId(null) } }}
                      autoFocus
                      style={{ fontSize: '1em', padding: '2px' }}
                    />
                  ) : (
                    <div
                      style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => setEditingFieldId(field.id)}
                    >
                      {fieldRenames[field.id] ?? field.name}
                    </div>
                  )}
                  <div style={{ margin: 0, fontSize: '0.8em', color: '#666' }}>{formatFieldType(field.type)}</div>
                </div>
              </div>
              {settingsOpen[field.id] && (
                <div style={{ marginLeft: 32, marginTop: 8, border: '1px solid #ccc', padding: 8, borderRadius: 4 }}>
                  {watchFields[index]?.include ? (
                    <>
                      <div>
                        <label>Label: </label>
                        <input {...register(`fields.${index}.label`)} />
                      </div>
                      <div>
                        <label>Placeholder: </label>
                        <input {...register(`fields.${index}.placeholder`)} />
                      </div>
                      <div>
                        <label>Default: </label>
                        {/* Default value input varies by field type */}
                        {field.type === 'singleSelect' ? (
                          <select {...register(`fields.${index}.defaultValue`)}>
                            <option value="">None</option>
                            {field.options?.choices.map((choice: any) => (
                              <option key={choice.id} value={choice.id}>{choice.name}</option>
                            ))}
                          </select>
                        ) : field.type === 'multipleSelect' ? (
                          <select multiple {...register(`fields.${index}.defaultValue`)}>
                            {field.options?.choices.map((choice: any) => (
                              <option key={choice.id} value={choice.id}>{choice.name}</option>
                            ))}
                          </select>
                        ) : field.type === 'currency' || field.type === 'number' ? (
                          <input type="number" {...register(`fields.${index}.defaultValue`)} />
                        ) : (
                          <input type={field.type === 'date' ? 'date' : 'text'} {...register(`fields.${index}.defaultValue`)} />
                        )}
                      </div>
                      <div>
                        <label>Required: </label>
                        <input type="checkbox" {...register(`fields.${index}.required`)} />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label>Ghost Default 🥷: </label>
                      {field.type === 'singleSelect' ? (
                        <select {...register(`fields.${index}.defaultValue`)}>
                          <option value="">None</option>
                          {field.options?.choices.map((choice: any) => (
                            <option key={choice.id} value={choice.id}>{choice.name}</option>
                          ))}
                        </select>
                      ) : field.type === 'multipleSelect' ? (
                        <select multiple {...register(`fields.${index}.defaultValue`)}>
                          {field.options?.choices.map((choice: any) => (
                            <option key={choice.id} value={choice.id}>{choice.name}</option>
                          ))}
                        </select>
                      ) : field.type === 'currency' || field.type === 'number' ? (
                        <input type="number" {...register(`fields.${index}.defaultValue`)} />
                      ) : (
                        <input
                          type={field.type === 'date' ? 'date' : 'text'}
                          {...register(`fields.${index}.defaultValue`)}
                          placeholder="Default for hidden field"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <h3>Information Fields</h3>
        {infoFields.map((field, idx) => {
          const index = fields.findIndex(f => f.id === field.id)
          const numVals = watchFields[index]?.numValues ?? 1
          const showFormula = !!watchFields[index]?.showFormula
          const previewValues = recordsQuery.data?.map(r => r.fields[field.name]).filter(v => v != null).slice(-numVals) ?? []
          const isExpanded = expandedInfo[field.id] ?? false
          return (
            <div key={field.id} style={{ borderBottom: '1px solid #ccc', padding: '8px 0' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setExpandedInfo(prev => ({ ...prev, [field.id]: !prev[field.id] }))}
              >
                <div>
                  {editingFieldId === field.id ? (
                    <input
                      type="text"
                      value={fieldRenames[field.id] ?? field.name}
                      onChange={e => setFieldRenames(prev => ({ ...prev, [field.id]: e.target.value }))}
                      onBlur={() => { handleSchemaUpdate(); setEditingFieldId(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') { handleSchemaUpdate(); setEditingFieldId(null) } }}
                      autoFocus
                      style={{ fontSize: '1em', padding: '2px' }}
                    />
                  ) : (
                    <div
                      style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => setEditingFieldId(field.id)}
                    >
                      {fieldRenames[field.id] ?? field.name}
                    </div>
                  )}
                  <div style={{ margin: 0, fontSize: '0.8em', color: '#666' }}>{formatFieldType(field.type)}</div>
                </div>
                <span>{isExpanded ? '▲' : '▼'}</span>
              </div>
              {isExpanded && (
                <div style={{ marginLeft: 32, marginTop: 8 }}>
                  <div><label>Show formula: </label><input type="checkbox" {...register(`fields.${index}.showFormula`)} /></div>
                  <div>
                    <label>Records to show: </label>
                    <select {...register(`fields.${index}.numValues`)}>
                      <option value={1}>Last record</option>
                      <option value={10}>Last 10 records</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 8, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4 }}>
                    {showFormula && (
                      <pre style={{ backgroundColor: '#eee', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
                        {field.type === 'formula'
                          ? field.options.formula
                          : `Rollup(${(field.options.rollup.fields || []).join(', ')} => ${field.options.rollup.function})`}
                      </pre>
                    )}
                    {previewValues.map((v, i) => (
                      <p key={i} style={{ margin: '4px 0' }}>
                        {Array.isArray(v) ? v.join(', ') : v}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <h2 style={{ marginBottom: 0 }}>{formTitle}</h2>
        <div
          style={{ fontSize: '0.9em', color: '#666', margin: '0 0 8px', cursor: editingTable ? 'auto' : 'pointer' }}
          onClick={() => !editingTable && setEditingTable(true)}
        >
          {editingTable ? (
            <input
              type="text"
              value={newTableName ?? tableName}
              onChange={e => setNewTableName(e.target.value)}
              onBlur={e => { handleTableRename(e.target.value); setEditingTable(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { handleTableRename(e.currentTarget.value); setEditingTable(false) } }}
              autoFocus
              style={{ fontSize: '0.9em', padding: '2px', width: 'auto' }}
            />
          ) : (
            <span onClick={() => setEditingTable(true)}>Linked to table: {newTableName ?? tableName}</span>
          )}
        </div>
        <button onClick={() => setPreviewKey((k) => k + 1)} style={{ marginBottom: 10 }}>
          Refresh Preview
        </button>
        <FormRunner key={previewKey} fields={watchFields} linkedTables={schemaQuery.data.linkedTables} baseTableName={tableName} />
        <div style={{ marginTop: 20 }}>
          <button onClick={handlePublish} disabled={publishing}>
            {publishing ? 'Publishing...' : 'Publish Form'}
          </button>
          {publishLink && (
            <div style={{ marginTop: 8 }}>
              <span>Public URL: </span>
              <a href={publishLink} target="_blank" rel="noopener noreferrer">{publishLink}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
