import { useQuery } from '@tanstack/react-query'
import type { PlanTier } from '@/lib/plan'

interface BannerConfig {
  text: string
  link?: string
  color?: string
}

interface SettingResponse {
  banner?: BannerConfig
  plan: PlanTier
  licenseExpiry?: number
  licenseEmail?: string
  maxUsers: number
  userCount: number
  demo?: boolean
}

export function useSetting() {
  const { data, isLoading } = useQuery({
    queryKey: ['setting'],
    queryFn: async () => {
      const res = await fetch('/api/setting')
      if (!res.ok) throw new Error('Failed to fetch setting')
      return res.json() as Promise<SettingResponse>
    },
  })

  return {
    banner: data?.banner,
    plan: data?.plan ?? 'FREE',
    licenseExpiry: data?.licenseExpiry,
    licenseEmail: data?.licenseEmail,
    maxUsers: data?.maxUsers ?? 1,
    userCount: data?.userCount ?? 0,
    demo: data?.demo ?? false,
    isLoading,
  }
}
