import { EditorPage } from '@/pages/editor/EditorPage'
import { HomePage } from '@/pages/home/HomePage'
import { ExportPage } from '@/pages/export/ExportPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { useNavigation } from './NavigationContext'

export function AppRouter() {
  const { page } = useNavigation()

  if (page === 'home') return <HomePage />
  if (page === 'export') return <ExportPage />
  if (page === 'settings') return <SettingsPage />
  return <EditorPage />
}
