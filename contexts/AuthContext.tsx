import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface UserData { username: string; password: string; apiKey: string; baseId: string }
interface AuthContextValue {
  user: UserData | null
  login: (username: string, password: string) => boolean
  register: (username: string, password: string, apiKey: string, baseId: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null)

  useEffect(() => {
    const session = localStorage.getItem('session')
    const stored = localStorage.getItem('user')
    if (session === 'true' && stored) {
      setUser(JSON.parse(stored) as UserData)
    }
  }, [])

  const register = (
    username: string,
    password: string,
    apiKey: string,
    baseId: string
  ): boolean => {
    const data: UserData = { username, password, apiKey, baseId }
    localStorage.setItem('user', JSON.stringify(data))
    localStorage.setItem('session', 'true')
    setUser(data)
    return true
  }

  const login = (username: string, password: string): boolean => {
    const stored = localStorage.getItem('user')
    if (!stored) return false
    const ud: UserData = JSON.parse(stored)
    if (ud.username === username && ud.password === password) {
      localStorage.setItem('session', 'true')
      setUser(ud)
      return true
    }
    return false
  }

  const logout = () => {
    localStorage.removeItem('session')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
