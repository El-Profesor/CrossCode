import { Executor } from '../../../executor/Executor'
import { createEl } from '../../../utilities/dom'
import { Ticker } from '../../../utilities/Ticker'
import { Action } from '../Action'
import { ActionMappingCursor } from './ActionMappingCursor'
import { ActionProxy } from './ActionProxy'
import { ControlFlow } from './ControlFlow'

export class ActionMapping {
    element: HTMLElement

    // Action proxies
    actionProxies: { [id: string]: ActionProxy } = {}

    // Break indices (occurs between actions[index] and actions[index + 1])
    // TODO: More generalizable layout
    breaks: number[] = []
    breakElements: HTMLElement[] = []

    // Control flow
    controlFlow: ControlFlow
    time: number = 0

    cursor: ActionMappingCursor

    // Other
    private _tickerId: string

    constructor() {
        this.create()
        // this.addBreak(1)

        this.element.addEventListener('click', (e) => {
            if (
                e.target !== this.element &&
                e.target !== this.element.parentElement &&
                !(e.target as HTMLElement).classList.contains('action-proxy-container')
            )
                return
        })

        this._tickerId = Ticker.instance.registerTick(this.tick.bind(this))

        // Create cursor
        setTimeout(() => {
            this.controlFlow = new ControlFlow(this)
            this.cursor = new ActionMappingCursor(this)

            // Update frames
            Executor.instance.visualization.program.update()
        }, 0)

        this.updateProxies()
    }

    getBreakIndexOfFrameIndex(index: number) {
        for (let i = 0; i < this.breaks.length; i++) {
            if (this.breaks[i] >= index) {
                return i
            }
        }
        return this.breaks.length
    }

    getProxyOfAction(action: Action) {
        return ActionProxy.all[action.state.id]
    }

    addBreak(index: number) {
        this.breaks.push(index)

        const breakEl = createEl('div', 'action-mapping-break', this.element.parentElement)
        this.breakElements.push(breakEl)
    }

    create() {
        this.element = createEl('div', 'action-mapping')
        const container = Executor.instance.visualization.container
        container.insertBefore(this.element, container.firstChild)

        // const margin = Editor.instance.getMaxWidth() + 70
        // this.element.style.left = `${margin}px`
    }

    tick(dt: number) {
        /* --------------- Update proxy positions --------------- */
        // const thisBbox = this.element.getBoundingClientRect()
        // const steps = Executor.instance.visualization.program.steps
        // for (const [stepId, proxy] of Object.entries(this.actionProxies)) {
        //     const step = steps.find((step) => step.execution.id === stepId)
        //     const bbox = step.renderer.element.getBoundingClientRect()
        //     proxy.element.style.top = `${bbox.top - thisBbox.y}px`
        //     proxy.element.style.height = `${bbox.height}px`
        // }
        /* -------------------- Update breaks ------------------- */
        // for (let i = 0; i < this.breaks.length; i++) {
        //     const breakElement = this.breakElements[i]
        //     const breakIndex = this.breaks[i]
        //     const step = this.action.steps[breakIndex]
        //     const nextStep = this.action.steps[breakIndex + 1]
        //     if (nextStep == null) {
        //         continue
        //     }
        //     const proxy = this.proxySteps[step.execution.id]
        //     const nextProxy = this.proxySteps[nextStep.execution.id]
        //     if (proxy == null || nextProxy == null) {
        //         continue
        //     }
        //     const bbox = proxy.element.getBoundingClientRect()
        //     const nextBbox = nextProxy.element.getBoundingClientRect()
        //     breakElement.style.top = `${(bbox.bottom + nextBbox.top) / 2 - thisBbox.y}px`
        // }
    }

    updateProxies() {
        /* ------------------- Update proxies ------------------- */
        const hits: Set<string> = new Set()
        const steps = Executor.instance.visualization.program.steps

        for (const step of steps) {
            let proxy = this.actionProxies[step.execution.id]

            if (proxy == null) {
                proxy = new ActionProxy(step)
                this.actionProxies[step.execution.id] = proxy
                this.element.appendChild(proxy.element)
            }

            proxy.update()

            hits.add(step.execution.id)
        }

        // Remove unused proxies
        for (const stepId of Object.keys(this.actionProxies)) {
            if (!hits.has(stepId)) {
                this.actionProxies[stepId].element.remove()
                delete this.actionProxies[stepId]
            }
        }

        this.controlFlow?.update()
        // setInterval(() => {
        //     this.controlFlow?.update()
        // }, 0)
    }

    duration() {
        return this.controlFlow.flowPath.getTotalLength()
    }

    /* ----------------------- Destroy ---------------------- */
    destroy() {
        this.element.remove()
        this.element = null

        for (const proxy of Object.values(this.actionProxies)) {
            proxy.destroy()
        }
        this.actionProxies = null

        this.breakElements.forEach((breakEl) => {
            breakEl.remove()
        })
        this.breakElements = null

        this.controlFlow?.destroy()
        this.controlFlow = null

        this.cursor?.destroy()
        this.cursor = null

        Ticker.instance.removeTickFrom(this._tickerId)
    }
}
