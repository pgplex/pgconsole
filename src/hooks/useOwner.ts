import { useSession } from '@/lib/auth-client'

export function useOwner(): boolean {
  const { isOwner } = useSession()
  return isOwner
}
