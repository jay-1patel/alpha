import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BrandingConfig {
  company_name: string
  bot_name: string
  logo_url: string
  about_text: string
  tagline: string
}

export const DEFAULT_BRANDING: BrandingConfig = {
  company_name: 'Admin',
  bot_name: 'WhatsApp Bot',
  logo_url: '',
  about_text: '',
  tagline: 'WhatsApp Bot Management',
}

/**
 * Public branding query. Unauthenticated: the login page needs the company
 * name and logo before an admin token exists.
 */
export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    queryFn: async () => {
      const res = await api.get('/api/branding')
      return { ...DEFAULT_BRANDING, ...(res as Partial<BrandingConfig>) }
    },
    staleTime: 60_000,
  })
}
