import * as ESTree from 'estree'
import { Editor } from '../editor/Editor'
import { ArrayRenderer } from './data/array/ArrayRenderer'
import { DataRenderer } from './data/DataRenderer'
import { ConcreteDataState, DataType } from './data/DataState'
import { LiteralRenderer } from './data/literal/LiteralRenderer'
import { ConcreteEnvironmentState, EnvironmentPositionModifierType } from './EnvironmentState'
import { IdentifierRenderer } from './identifier/IdentifierRenderer'

export function createDataRenderer(data: ConcreteDataState) {
    const mapping = {
        [DataType.Literal]: LiteralRenderer,
        [DataType.Array]: ArrayRenderer,
    }

    if (!(data.prototype.type in mapping)) {
        console.error('No renderer for', data.prototype.type)
    }

    return new mapping[data.prototype.type]()
}

export class EnvironmentRenderer {
    element: HTMLDivElement
    border: HTMLDivElement

    dataRenderers: { [id: string]: DataRenderer } = {}
    identifierRenderers: { [id: string]: IdentifierRenderer } = {}

    constructor() {
        this.element = document.createElement('div')
        this.element.classList.add('environment')

        this.border = document.createElement('div')
        this.border.classList.add('environment-border')
        this.element.append(this.border)
    }

    setState(state: ConcreteEnvironmentState) {
        // Apply transform
        this.element.style.top = `${state.transform.rendered.y}px`
        this.element.style.left = `${state.transform.rendered.x}px`

        // Memory
        this.renderMemory(state)

        // Render identifiers
        this.renderIdentifiers(state)

        // Update size
        this.element.style.width = `${state.transform.rendered.width}px`
        this.element.style.height = `${state.transform.rendered.height}px`

        // Update border
        this.border.style.width = `${state.transform.rendered.width}px`
        this.border.style.height = `${state.transform.rendered.height}px`
    }

    renderMemory(state: ConcreteEnvironmentState) {
        // Hit test
        const hits = new Set()

        // Only render literals and arrays
        const memory = state.memory
            .filter((m) => m != null)
            .filter((data) => data.prototype.type == DataType.Literal || data.prototype.type == DataType.Array)

        // Render data
        for (const data of memory) {
            // Create renderer if not there
            if (!(data.prototype.id in this.dataRenderers)) {
                const renderer = createDataRenderer(data)
                this.dataRenderers[data.prototype.id] = renderer

                DataRenderer.getStage().append(renderer.element)
            }

            hits.add(data.prototype.id)
            this.dataRenderers[data.prototype.id].setState(data)
        }

        // Remove data that are no longer in the view
        for (const id of Object.keys(this.dataRenderers)) {
            if (!hits.has(id)) {
                const renderer = this.dataRenderers[id]
                renderer.destroy()
                renderer.element.remove()
                delete this.dataRenderers[id]
            }
        }
    }

    renderIdentifiers(state: ConcreteEnvironmentState) {
        // Hit test
        const hits = new Set()

        for (const scope of state.scope) {
            for (const name of Object.keys(scope)) {
                if (!(name in this.identifierRenderers)) {
                    const renderer = new IdentifierRenderer()
                    this.identifierRenderers[name] = renderer

                    DataRenderer.getStage().appendChild(renderer.element)
                }

                hits.add(name)
                this.identifierRenderers[name].setState(scope[name])
            }
        }

        // Remove hits that aren't used
        for (const name of Object.keys(this.identifierRenderers)) {
            if (!hits.has(name)) {
                const renderer = this.identifierRenderers[name]
                renderer.destroy()
                renderer.element.remove()
                delete this.identifierRenderers[name]
            }
        }
    }

    destroy() {
        for (const id of Object.keys(this.dataRenderers)) {
            const renderer = this.dataRenderers[id]
            renderer.destroy()
            renderer.element.remove()
        }

        for (const name of Object.keys(this.identifierRenderers)) {
            const renderer = this.identifierRenderers[name]
            renderer.destroy()
            renderer.element.remove()
        }

        this.element.remove()
        this.border.remove()
    }
}

function applyPositionModifiers(element: HTMLDivElement, state: ConcreteEnvironmentState) {
    const modifiers = state.transform.positionModifiers

    const fitted = {
        [EnvironmentPositionModifierType.NextToCode]: false,
        [EnvironmentPositionModifierType.AboveView]: false,
        [EnvironmentPositionModifierType.BelowView]: false,
    }

    for (let i = modifiers.length - 1; i >= 0; i--) {
        const modifier = modifiers[i]

        if (fitted[modifier.type]) continue

        if (modifier.type == EnvironmentPositionModifierType.NextToCode) {
            const loc = modifier.value as ESTree.SourceLocation

            // Place this view next to the code
            const target = Editor.instance.computeBoundingBox(loc.start.line)
            const current = element.getBoundingClientRect()

            const delta = target.y - current.y
            state.transform.rendered.y += delta
        }

        fitted[modifier.type] = true
    }
}
