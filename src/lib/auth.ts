import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from './db'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { sede: true }
        })

        if (!user || !user.active) {
          return null
        }

        // Por ahora, comparación directa (luego usar bcrypt)
        const isValid = await bcrypt.compare(credentials.password,user.password)


        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sedeId: user.sedeId,
          sedeNombre: user.sede?.nombre || null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.sedeId = user.sedeId
        token.sedeNombre = user.sedeNombre
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.sedeId = token.sedeId as string | null
        session.user.sedeNombre = token.sedeNombre as string | null
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET || 'herramientas-secret-key-2024'
}

// Extender tipos de NextAuth
declare module 'next-auth' {
  interface User {
    id: string
    role: string
    sedeId: string | null
    sedeNombre: string | null
  }
  interface Session {
    user: User & {
      id: string
      email: string
      name: string
      role: string
      sedeId: string | null
      sedeNombre: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    sedeId: string | null
    sedeNombre: string | null
  }
}
