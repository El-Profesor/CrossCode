import { DataRenderer } from '../DataRenderer'
import { DataState, TransformStyles } from '../DataState'

export class FunctionRenderer extends DataRenderer {
    prevRenderStyles: TransformStyles

    constructor() {
        super()
        this.element.classList.add('data-function')
    }

    setState(data: DataState) {
        this.element.innerText = 'f'
    }
}