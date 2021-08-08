import { Accessor, AccessorType, Data, DataType } from '../../../environment/Data'
import { Environment } from '../../../environment/Environment'
import { AnimationNode, AnimationOptions } from '../AnimationNode'

export default class PlaceAnimation extends AnimationNode {
    inputSpecifier: Accessor[]
    outputSpecifier: Accessor[]

    constructor(inputSpecifier: Accessor[], outputSpecifier: Accessor[], options: AnimationOptions = {}) {
        super(options)
        this.inputSpecifier = inputSpecifier
        this.outputSpecifier = outputSpecifier
    }

    begin(environment: Environment) {}

    seek(environment: Environment, time: number) {
        let t = super.ease(time / this.duration)

        let input = environment.resolvePath(this.inputSpecifier) as Data
        if (input.type == DataType.ID) {
            input = environment.resolve({ type: AccessorType.ID, value: input.value as string }) as Data
        }

        input.transform.z = 1 - t
    }

    end(environment: Environment) {
        let input = environment.resolvePath(this.inputSpecifier) as Data
        if (input.type == DataType.ID) {
            input = environment.resolve({ type: AccessorType.ID, value: input.value as string }) as Data
        }

        const to = environment.resolvePath(this.outputSpecifier) as Data

        if (to instanceof Environment) {
            environment.removeAt(environment.getMemoryLocation(input).foundLocation)
        } else {
            // Remove the copy
            environment.removeAt(environment.getMemoryLocation(input).foundLocation)
            to.replaceWith(input, { frame: true })
        }

        input.transform.floating = false
        input.transform.z = 0

        // Put it in the floating stack
        const FloatingStack = environment.resolvePath([{ type: AccessorType.Symbol, value: '_FloatingStack' }], {
            noResolvingId: true,
        }) as Data

        ;(FloatingStack.value as Data[]).pop()
    }
}
