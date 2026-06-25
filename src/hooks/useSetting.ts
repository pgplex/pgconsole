import { useQuery } from '@tanstack/react-query'

interface BannerConfig {
  text: string
  link?: string
  color?: string
}

interface BrandingConfig {
  logo?: string
  logo_link?: string
}

interface SettingResponse {
  branding?: BrandingConfig
  banner?: BannerConfig
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
    branding: data?.branding,
    banner: data?.banner,
    demo: data?.demo ?? false,
    isLoading,
  }
}
