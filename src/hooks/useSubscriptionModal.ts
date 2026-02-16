import { createContext, useContext } from 'react'

export interface SubscriptionModalContextValue {
  open: (reason?: string) => void
}

export const SubscriptionModalContext = createContext<SubscriptionModalContextValue | null>(null)

export function useSubscriptionModal(): SubscriptionModalContextValue {
  const context = useContext(SubscriptionModalContext)
  if (!context) {
    throw new Error('useSubscriptionModal must be used within SubscriptionModalProvider')
  }
  return context
}
