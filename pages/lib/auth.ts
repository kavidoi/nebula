import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { query } from './db'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'

export interface User {
  id: number
  username: string
  password_hash: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: number
  expires_at: string
  created_at: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: number): Promise<string> {
  const token = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: '7d', // 7 days
  })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt]
  )

  return token
}

export async function verifySession(token: string): Promise<User | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    const session = await query(
      'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [token]
    )

    if (session.rows.length === 0) {
      return null
    }

    const user = await query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    )

    return user.rows[0]
  } catch (error) {
    return null
  }
}

export async function createUser(username: string, password: string): Promise<User> {
  const passwordHash = await hashPassword(password)
  const result = await query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
    [username, passwordHash]
  )
  return result.rows[0]
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  )
  return result.rows[0] || null
}

export async function clearExpiredSessions() {
  await query(
    'DELETE FROM sessions WHERE expires_at <= NOW()'
  )
}

export { query }
