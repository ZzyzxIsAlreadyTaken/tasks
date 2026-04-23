import { timingSafeEqual } from 'node:crypto'
import { redirect } from '@tanstack/react-router'
import { clearSession, getSession, updateSession } from '@tanstack/react-start/server'

type AuthSessionData = {
  signedIn?: boolean
}

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

function getSessionPassword() {
  const value = process.env.SESSION_SECRET
  if (!value) {
    throw new Error('SESSION_SECRET is required.')
  }
  return value
}

function getSharedPassword() {
  const value = process.env.APP_SHARED_PASSWORD
  if (!value) {
    throw new Error('APP_SHARED_PASSWORD is required.')
  }
  return value
}

function authSessionConfig() {
  return {
    password: getSessionPassword(),
    name: 'taskboard_session',
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProduction(),
      path: '/',
    },
  }
}

function safePasswordEquals(input: string, expected: string) {
  const left = Buffer.from(input)
  const right = Buffer.from(expected)

  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

export async function isSignedIn() {
  const session = await getSession<AuthSessionData>(authSessionConfig())
  return session.data.signedIn === true
}

export async function requireSignedIn() {
  if (await isSignedIn()) {
    return
  }

  throw redirect({
    to: '/signin',
    search: { error: undefined },
  })
}

export async function trySignIn(password: string) {
  if (!safePasswordEquals(password, getSharedPassword())) {
    return false
  }

  await updateSession<AuthSessionData>(authSessionConfig(), (oldData) => ({
    ...oldData,
    signedIn: true,
  }))
  return true
}

export async function signOut() {
  await clearSession(authSessionConfig())
}
