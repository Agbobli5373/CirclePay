'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CreateSusuPayload } from './api'

export const qk = {
  me: ['me'] as const,
  funds: (scope: string) => ['funds', scope] as const,
  fund: (id: string) => ['fund', id] as const,
  activity: ['activity'] as const,
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: qk.me, queryFn: api.auth.me, enabled, retry: false })
}

export function useFunds(scope: 'mine' | 'all' = 'mine') {
  return useQuery({ queryKey: qk.funds(scope), queryFn: () => api.funds.list(scope) })
}

export function useFund(id: string) {
  return useQuery({ queryKey: qk.fund(id), queryFn: () => api.funds.detail(id), enabled: !!id })
}

export function useActivity() {
  return useQuery({ queryKey: qk.activity, queryFn: api.activity.list })
}

export function useCreateFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSusuPayload) => api.funds.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => api.funds.acceptInvite(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useInvite(fundId: string) {
  return useMutation({ mutationFn: (phones: string[]) => api.funds.invite(fundId, phones) })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.auth.updateMe(name),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => qc.clear(),
  })
}
