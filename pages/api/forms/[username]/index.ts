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
  isActive: boolean
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<FormRecord[] | { error: string }>
) {
  const { username } = req.query as { username: string }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const dir = path.join(process.cwd(), 'data', 'forms')
  if (!fs.existsSync(dir)) {
    return res.status(200).json([])
  }

  const files = fs
    .readdirSync(dir)
    .filter(f => f.startsWith(`${username}-`) && f.endsWith('.json'))
  const records: FormRecord[] = files
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
