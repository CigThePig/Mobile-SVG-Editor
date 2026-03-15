import { useEffect, type PropsWithChildren } from 'react'
import { bootstrapCommands } from '@/features/documents/services/bootstrapCommands'
import { useBootstrapDocument } from '@/features/workspace/hooks/useBootstrapDocument'
import { NavigationProvider } from '@/app/routing/NavigationContext'

function BootstrapLayer() {
  useBootstrapDocument()
  return null
}

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    bootstrapCommands()
  }, [])

  return (
    <NavigationProvider>
      <BootstrapLayer />
      {children}
    </NavigationProvider>
  )
}
