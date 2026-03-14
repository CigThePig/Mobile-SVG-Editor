import { registerCommand } from './commandRegistry'
import { addRectCommand, groupSelectionCommand, ungroupSelectionCommand } from './documentCommands'

let bootstrapped = false

export function bootstrapCommands() {
  if (bootstrapped) return
  registerCommand(addRectCommand)
  registerCommand(groupSelectionCommand)
  registerCommand(ungroupSelectionCommand)
  bootstrapped = true
}
