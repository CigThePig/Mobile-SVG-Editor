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
import {
  convertToPathCommand,
  movePointCommand,
  moveHandleCommand,
  addPointCommand,
  deletePointCommand,
  convertPointTypeCommand,
  toggleClosedCommand,
  booleanUnionCommand,
  booleanSubtractCommand,
  booleanIntersectCommand,
  booleanExcludeCommand,
  alignNodesCommand,
  distributeNodesCommand
} from '@/features/path/services/pathCommands'

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
  // Path / geometry editing commands
  registerCommand(convertToPathCommand)
  registerCommand(movePointCommand)
  registerCommand(moveHandleCommand)
  registerCommand(addPointCommand)
  registerCommand(deletePointCommand)
  registerCommand(convertPointTypeCommand)
  registerCommand(toggleClosedCommand)
  registerCommand(booleanUnionCommand)
  registerCommand(booleanSubtractCommand)
  registerCommand(booleanIntersectCommand)
  registerCommand(booleanExcludeCommand)
  registerCommand(alignNodesCommand)
  registerCommand(distributeNodesCommand)
  bootstrapped = true
}
