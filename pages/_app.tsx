import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { UserProvider } from '@auth0/nextjs-auth0/client'
import { SpeedInsights } from '@vercel/speed-insights/next'

function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <UserProvider>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
        <SpeedInsights />
      </QueryClientProvider>
    </UserProvider>
  )
}

export default MyApp
