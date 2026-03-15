import { nanoid } from 'nanoid'
import type { EditorCommand } from './commands'
import type { GradientResource, GradientStop } from '@/model/resources/resourceTypes'

export const addGradientCommand: EditorCommand<{ type: 'linearGradient' | 'radialGradient'; name?: string }> = {
  id: 'document.addGradient',
  label: 'Add Gradient',
  run: ({ document }, payload) => {
    const gradient: GradientResource = {
      id: nanoid(),
      name: payload.name ?? (payload.type === 'linearGradient' ? 'Linear Gradient' : 'Radial Gradient'),
      type: payload.type,
      stops: [
        { offset: 0, color: '#000000', opacity: 1 },
        { offset: 1, color: '#ffffff', opacity: 1 }
      ]
    }
    return {
      label: 'Add Gradient',
      document: {
        ...document,
        updatedAt: new Date().toISOString(),
        resources: {
          ...document.resources,
          gradients: [...document.resources.gradients, gradient]
        }
      }
    }
  }
}

export const updateGradientCommand: EditorCommand<{ id: string; name?: string; type?: 'linearGradient' | 'radialGradient'; stops?: GradientStop[] }> = {
  id: 'document.updateGradient',
  label: 'Update Gradient',
  run: ({ document }, payload) => {
    const gradients = document.resources.gradients.map((g) => {
      if (g.id !== payload.id) return g
      return {
        ...g,
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.type !== undefined ? { type: payload.type } : {}),
        ...(payload.stops !== undefined ? { stops: payload.stops } : {})
      }
    })
    return {
      label: 'Update Gradient',
      document: {
        ...document,
        updatedAt: new Date().toISOString(),
        resources: { ...document.resources, gradients }
      }
    }
  }
}

export const deleteGradientCommand: EditorCommand<{ id: string }> = {
  id: 'document.deleteGradient',
  label: 'Delete Gradient',
  run: ({ document }, { id }) => {
    const gradients = document.resources.gradients.filter((g) => g.id !== id)
    return {
      label: 'Delete Gradient',
      document: {
        ...document,
        updatedAt: new Date().toISOString(),
        resources: { ...document.resources, gradients }
      }
    }
  }
}

export const applyGradientToNodeCommand: EditorCommand<{ nodeId: string; gradientId: string }> = {
  id: 'document.applyGradientToNode',
  label: 'Apply Gradient',
  run: ({ document }, { nodeId, gradientId }) => {
    function walk(node: { id: string; children?: any[]; style?: any }): any {
      if (node.id === nodeId) {
        return { ...node, style: { ...(node.style ?? {}), fill: { kind: 'gradient', resourceId: gradientId } } }
      }
      if (!node.children?.length) return node
      return { ...node, children: node.children.map(walk) }
    }
    return {
      label: 'Apply Gradient',
      selectionIds: [nodeId],
      document: {
        ...document,
        updatedAt: new Date().toISOString(),
        root: walk(document.root) as typeof document.root
      }
    }
  }
}
