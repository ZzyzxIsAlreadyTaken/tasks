import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { isSignedIn, signOut, trySignIn } from './auth'

const signInSchema = z.object({
  password: z.string().min(1),
})

export const loadAuthState = createServerFn({ method: 'GET' }).handler(async () => {
  return {
    signedIn: await isSignedIn(),
  }
})

export const signInWithPassword = createServerFn({ method: 'POST' })
  .inputValidator((input) => signInSchema.parse(input))
  .handler(async ({ data }) => {
    const ok = await trySignIn(data.password)
    return {
      ok,
    }
  })

export const signOutCurrentSession = createServerFn({ method: 'POST' }).handler(async () => {
  await signOut()
  return { ok: true }
})
