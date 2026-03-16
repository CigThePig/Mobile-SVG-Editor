import { createContext, useContext, useState, type PropsWithChildren } from 'react'

export type AppPage = 'home' | 'editor' | 'export' | 'settings'

interface NavigationContextValue {
  page: AppPage
  navigate: (page: AppPage) => void
}

const NavigationContext = createContext<NavigationContextValue>({
  page: 'editor',
  navigate: () => {}
})

export function NavigationProvider({ children }: PropsWithChildren) {
  const [page, setPage] = useState<AppPage>('editor')
  return (
    <NavigationContext.Provider value={{ page, navigate: setPage }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  return useContext(NavigationContext)
}
