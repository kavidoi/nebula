import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

type Data = { tables: string[] } | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = req.headers['x-api-key'] as string
  const baseId = req.headers['x-base-id'] as string
  if (!apiKey || !baseId) {
    return res.status(400).json({ error: 'Missing API key or Base ID in headers' })
  }

  try {
    const airtableRes = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    const tables = (airtableRes.data.tables as any[]).map(t => t.name)
    return res.status(200).json({ tables })
  } catch (err: any) {
    console.error('Airtable API error:', err.response?.data || err.message)
    const errorData = err.response?.data
    let msg = 'Unknown error'

    if (errorData?.error === 'NOT_FOUND') {
      msg = 'Base not found. Please check your Base ID.'
    } else if (
      errorData?.error === 'UNAUTHORIZED' ||
      err.response?.status === 401
    ) {
      msg = 'Invalid API key. Please check your API key.'
    } else if (err.response?.status === 404) {
      msg = 'Resource not found. The API endpoint may have changed.'
    } else if (err.response?.status === 403) {
      msg = 'Permission denied. Your API key may not have access to this base.'
    } else {
      msg = errorData?.error?.message || err.message || 'Unknown error'
    }

    return res.status(500).json({ error: msg })
  }
}
