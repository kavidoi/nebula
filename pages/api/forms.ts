import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

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
  res: NextApiResponse<{ formId: string } | { error: string } | FormRecord[]>
) {
  // List forms for a user
  if (req.method === 'GET') {
    const username = req.query.username as string
    if (!username) {
      return res.status(400).json({ error: 'Missing username' })
    }
    const dir = path.join(process.cwd(), 'data', 'forms')
    if (!fs.existsSync(dir)) {
      return res.status(200).json([])
    }
    const files = fs
      .readdirSync(dir)
      .filter(f => f.startsWith(`${username}-`) && f.endsWith('.json'))
    const records = files
      .map(file => {
        try {
          const content = fs.readFileSync(path.join(dir, file), 'utf-8')
          return JSON.parse(content) as FormRecord
        } catch {
          return null
        }
      })
      .filter((r): r is FormRecord => r != null)
    return res.status(200).json(records)
  }
  // Create a new form
  if (req.method === 'POST') {
    const { username, apiKey, baseId, tableName, fields, formTitle } = req.body
    if (!username || !apiKey || !baseId || !tableName || !fields || !formTitle) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }
    const formId = randomUUID()
    const createdAt = new Date().toISOString()
    const record: FormRecord = { formId, username, apiKey, baseId, tableName, fields, formTitle, createdAt, isActive: true }
    const dir = path.join(process.cwd(), 'data', 'forms')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${username}-${formId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2))
    return res.status(201).json({ formId })
  }
  res.setHeader('Allow', ['POST', 'GET'])
  return res.status(405).json({ error: 'Method not allowed' })
}
