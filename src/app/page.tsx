'use client'

import { useSession } from 'next-auth/react'
import { LoginForm } from '@/components/login-form'
import { MainApp } from '@/components/main-app'

export default function HomePage() {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <LoginForm />
  }

  return <MainApp />
}
