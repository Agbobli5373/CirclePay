'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CreateSusuPayload, type CreateMedicalPayload } from './api'

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funds'] })
      qc.invalidateQueries({ queryKey: ['my-invites'] })
    },
  })
}

/** Pending invites addressed to me (dashboard + funds "Invitations" inbox). */
export function useMyInvites() {
  return useQuery({ queryKey: ['my-invites'], queryFn: api.funds.myInvites })
}

export function useDeclineInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => api.funds.declineInvite(inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-invites'] }),
  })
}

export function useInvite(fundId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (phones: string[]) => api.funds.invite(fundId, phones),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-invites', fundId] })
      qc.invalidateQueries({ queryKey: qk.fund(fundId) })
    },
  })
}

export function useFundInvites(fundId: string, enabled = true) {
  return useQuery({ queryKey: ['fund-invites', fundId], queryFn: () => api.funds.invites(fundId), enabled: !!fundId && enabled })
}

export function useResendInvite(fundId: string) {
  return useMutation({ mutationFn: (inviteId: string) => api.funds.resendInvite(fundId, inviteId) })
}

export function useRevokeInvite(fundId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => api.funds.revokeInvite(fundId, inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-invites', fundId] })
      qc.invalidateQueries({ queryKey: qk.fund(fundId) })
    },
  })
}

// ----- Medical fundraising (EM) -----

export function useCreateMedical() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateMedicalPayload) => api.fundraisers.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-fundraisers'] }),
  })
}

export function useFundraiser(id: string) {
  return useQuery({ queryKey: ['fundraiser', id], queryFn: () => api.fundraisers.detail(id), enabled: !!id })
}

export function useMyFundraisers() {
  return useQuery({ queryKey: ['my-fundraisers'], queryFn: api.fundraisers.mine })
}

export function usePublicFundraiser(slug: string) {
  return useQuery({ queryKey: ['public-fundraiser', slug], queryFn: () => api.public.fundraiser(slug), enabled: !!slug })
}

export function useVerifyPayee(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (decision: 'verified' | 'rejected') => api.fundraisers.verifyPayee(id, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fundraiser', id] }),
  })
}

export function useReleasePayout(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.fundraisers.release(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fundraiser', id] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.auth.updateMe(name),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ phone, pin }: { phone: string; pin: string }) => api.auth.login(phone, pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => qc.clear(),
  })
}
