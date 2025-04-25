import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

type Data = { id: string; name: string; fields: any[]; linkedTables: { id: string; name: string }[] } | { error: string }

// Request payload for PATCH
interface PatchRequest { tableId: string; newTableName?: string; fieldRenames?: { id: string; name: string }[] }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const apiKey = req.headers['x-api-key'] as string
  const baseId = req.headers['x-base-id'] as string
  if (!apiKey || !baseId) {
    return res.status(400).json({ error: 'Missing API key or Base ID' })
  }

  // Handle renaming via PATCH
  if (req.method === 'PATCH') {
    const { tableId, newTableName, fieldRenames } = req.body as PatchRequest
    if (!tableId || (!newTableName && (!fieldRenames || fieldRenames.length === 0))) {
      return res.status(400).json({ error: 'Missing tableId or update fields' })
    }
    try {
      // Rename table if requested
      if (newTableName) {
        await axios.patch(
          `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}`,
          { name: newTableName },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
        )
      }
      // Rename fields if requested
      if (fieldRenames) {
        for (const fr of fieldRenames) {
          await axios.patch(
            `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields/${fr.id}`,
            { name: fr.name },
            { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
          )
        }
      }
      // Fetch updated schema
      const airtableRes = await axios.get(
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      const allTables = airtableRes.data.tables as any[]
      const table = allTables.find(t => t.id === tableId)
      if (!table) {
        return res.status(404).json({ error: 'Table not found' })
      }
      const linkedTables = allTables.map(t => ({ id: t.id, name: t.name }))
      return res.status(200).json({ id: table.id, name: table.name, fields: table.fields, linkedTables })
    } catch (err: any) {
      console.error('Airtable schema PATCH error:', err.response?.data || err.message)
      return res.status(500).json({ error: 'Failed to update schema' })
    }
  }

  // Only GET after here
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'PATCH'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tableName = req.query.tableName as string
  if (!tableName) {
    return res.status(400).json({ error: 'Missing tableName' })
  }

  try {
    const airtableRes = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    const allTables = airtableRes.data.tables as any[]
    const table = allTables.find(t => t.name === tableName)
    if (!table) {
      return res.status(404).json({ error: 'Table not found' })
    }
    const linkedTables = allTables.map(t => ({ id: t.id, name: t.name }))
    return res.status(200).json({ id: table.id, name: table.name, fields: table.fields, linkedTables })
  } catch (err: any) {
    console.error('Airtable schema API error:', err.response?.data || err.message)
    const errorData = err.response?.data
    let msg = 'Unknown error'
    if (errorData?.error === 'NOT_FOUND') msg = 'Base not found. Please check your Base ID.'
    else if (errorData?.error === 'UNAUTHORIZED' || err.response?.status === 401) msg = 'Invalid API key. Please check your API key.'
    else if (err.response?.status === 404) msg = 'Table not found. Please check your table name.'
    else if (err.response?.status === 403) msg = 'Permission denied. Your API key may not have access to this table.'
    else msg = errorData?.error?.message || err.message || 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
