import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

type Data = { records: any[] } | { record: any } | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // Handle record creation via POST
  if (req.method === 'POST') {
    const apiKey = req.headers['x-api-key'] as string
    const baseId = req.headers['x-base-id'] as string
    const tableName = req.query.tableName as string
    if (!apiKey || !baseId || !tableName) {
      return res.status(400).json({ error: 'Missing API key, Base ID, or tableName' })
    }
    try {
      const fields = req.body
      const createRes = await axios.post(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
        { fields },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
      )
      return res.status(201).json({ record: createRes.data })
    } catch (err: any) {
      console.error('Airtable create record error:', err.response?.data || err.message)
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.error ||
        err.message ||
        'Unknown error creating record'
      return res.status(500).json({ error: msg })
    }
  }
  // Handle record fetch via GET
  if (req.method === 'GET') {
    const apiKey = req.headers['x-api-key'] as string
    const baseId = req.headers['x-base-id'] as string
    const tableName = req.query.tableName as string
    if (!apiKey || !baseId || !tableName) {
      return res.status(400).json({ error: 'Missing API key, Base ID, or tableName' })
    }
    try {
      const airtableRes = await axios.get(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      return res.status(200).json({ records: airtableRes.data.records })
    } catch (err: any) {
      console.error('Airtable records API error:', err.response?.data || err.message)
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.error ||
        err.message ||
        'Unknown error fetching records'
      return res.status(500).json({ error: msg })
    }
  }
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
