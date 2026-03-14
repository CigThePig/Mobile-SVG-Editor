import type { EditorCommand } from './commands'

const registry = new Map<string, EditorCommand<any>>()

export function registerCommand<TPayload>(command: EditorCommand<TPayload>) {
  registry.set(command.id, command)
}

export function getCommand(id: string) {
  return registry.get(id)
}

export function listCommands() {
  return Array.from(registry.values())
}
