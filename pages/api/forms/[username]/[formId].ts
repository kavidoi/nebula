import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

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

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<FormRecord | { error: string } | { formId: string }>
) {
  const { username, formId } = req.query as { username: string; formId: string }

  // Delete a form
  if (req.method === 'DELETE') {
    const filePath = path.join(process.cwd(), 'data', 'forms', `${username}-${formId}.json`)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Form not found' })
    }
    try {
      fs.unlinkSync(filePath)
      return res.status(200).json({ formId })
    } catch (e) {
      console.error('Error deleting form:', e)
      return res.status(500).json({ error: 'Failed to delete form' })
    }
  }

  // Get a form
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const filePath = path.join(process.cwd(), 'data', 'forms', `${username}-${formId}.json`)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Form not found' })
  }

  try {
    const file = fs.readFileSync(filePath, 'utf-8')
    const record: FormRecord = JSON.parse(file)
    return res.status(200).json(record)
  } catch (err) {
    console.error('Error reading form record:', err)
    return res.status(500).json({ error: 'Failed to read form record' })
  }
}
