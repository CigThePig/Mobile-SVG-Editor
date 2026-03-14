import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './routing/AppRouter'

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
