'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/logo'
import { Loader2, AlertCircle } from 'lucide-react'
import { useMe, useAcceptInvite } from '@/lib/queries'
import { ApiError } from '@/lib/api'

export default function JoinPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const router = useRouter()
  const { data: me, isLoading: meLoading, isError: meError } = useMe()
  const accept = useAcceptInvite()
  const [errored, setErrored] = useState(false)
  const [msg, setMsg] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (meLoading) return
    if (meError || !me) {
      // Not signed in — send to onboarding (they can re-open the link after).
      router.replace('/onboarding')
      return
    }
    if (ran.current) return
    ran.current = true
    accept
      .mutateAsync(token)
      .then((res) => router.replace(res.fundId ? `/funds/${res.fundId}` : '/funds'))
      .catch((e) => {
        setMsg(e instanceof ApiError ? e.message : 'This invite could not be accepted.')
        setErrored(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meLoading, meError, me, token])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <Logo />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md cp-card p-8 text-center space-y-4">
          {!errored ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-foreground font-medium">Joining the Susu…</p>
            </>
          ) : (
            <>
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <h1 className="text-xl font-semibold text-foreground">Couldn&apos;t join</h1>
              <p className="text-sm text-secondary">{msg}</p>
              <Link href="/" className="cp-btn-ghost inline-flex">Go home</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
