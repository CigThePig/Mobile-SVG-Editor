import { registerCommand } from './commandRegistry'
import {
  addRectCommand,
  addEllipseCommand,
  addLineCommand,
  addPolygonCommand,
  addStarCommand,
  addTextCommand,
  deleteNodesCommand,
  duplicateNodesCommand,
  reorderNodeCommand,
  setNodeVisibilityCommand,
  setNodeLockedCommand,
  updateNodeStyleCommand,
  updateNodePropertiesCommand,
  updateNodeFillCommand,
  updateNodeStrokeCommand,
  groupSelectionCommand,
  ungroupSelectionCommand
} from './documentCommands'

let bootstrapped = false

export function bootstrapCommands() {
  if (bootstrapped) return
  registerCommand(addRectCommand)
  registerCommand(addEllipseCommand)
  registerCommand(addLineCommand)
  registerCommand(addPolygonCommand)
  registerCommand(addStarCommand)
  registerCommand(addTextCommand)
  registerCommand(deleteNodesCommand)
  registerCommand(duplicateNodesCommand)
  registerCommand(reorderNodeCommand)
  registerCommand(setNodeVisibilityCommand)
  registerCommand(setNodeLockedCommand)
  registerCommand(updateNodeStyleCommand)
  registerCommand(updateNodePropertiesCommand)
  registerCommand(updateNodeFillCommand)
  registerCommand(updateNodeStrokeCommand)
  registerCommand(groupSelectionCommand)
  registerCommand(ungroupSelectionCommand)
  bootstrapped = true
}
