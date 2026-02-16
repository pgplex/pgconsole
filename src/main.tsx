import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KeyboardShortcutsProvider } from '@/hooks/use-keyboard-shortcuts'
import './index.css'
import App from './App.tsx'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <KeyboardShortcutsProvider>
        <App />
      </KeyboardShortcutsProvider>
    </QueryClientProvider>
  </StrictMode>,
)
