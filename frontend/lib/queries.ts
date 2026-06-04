'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CreateSusuPayload } from './api'

export const qk = {
  me: ['me'] as const,
  funds: (scope: string) => ['funds', scope] as const,
  fund: (id: string) => ['fund', id] as const,
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

export function useCreateFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSusuPayload) => api.funds.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useJoinFund(fundId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.funds.join(fundId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.fund(fundId) })
      qc.invalidateQueries({ queryKey: ['funds'] })
    },
  })
}

export function useInvite(fundId: string) {
  return useMutation({ mutationFn: (phones: string[]) => api.funds.invite(fundId, phones) })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => qc.clear(),
  })
}
