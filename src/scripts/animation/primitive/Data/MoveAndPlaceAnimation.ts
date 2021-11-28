import { replacePrototypicalDataWith } from '../../../environment/data/data'
import { instanceOfPrototypicalData, PrototypicalDataState } from '../../../environment/data/DataState'
import {
    addPrototypicalPath,
    beginPrototypicalPath,
    endPrototypicalPath,
    lookupPrototypicalPathById,
    PrototypicalPath,
    removePrototypicalPath,
    seekPrototypicalPath,
} from '../../../environment/data/path/path'
import {
    createPrototypicalMovementPath,
    PrototypicalMovementPath,
} from '../../../environment/data/path/primitives/PrototypicalMovementPath'
import {
    createPrototypicalPlacementPath,
    PrototypicalPlacementPath,
} from '../../../environment/data/path/primitives/PrototypicalPlacementPath'
import { getMemoryLocation, removeAt, resolvePath } from '../../../environment/environment'
import { Accessor, accessorsToString, instanceOfPrototypicalEnvironment } from '../../../environment/EnvironmentState'
import { updateRootViewLayout } from '../../../environment/layout'
import { remap } from '../../../utilities/math'
import { RootViewState } from '../../../view/ViewState'
import { duration } from '../../animation'
import { AnimationData, AnimationRuntimeOptions } from '../../graph/AnimationGraph'
import { AnimationNode, AnimationOptions, createAnimationNode } from '../AnimationNode'

export interface MoveAndPlaceAnimation extends AnimationNode {
    inputSpecifier: Accessor[]
    outputSpecifier: Accessor[]
    noMove: boolean
}

function onBegin(animation: MoveAndPlaceAnimation, view: RootViewState, options: AnimationRuntimeOptions) {
    const environment = view.environment

    const from = resolvePath(environment, animation.inputSpecifier, null, null, {
        noResolvingReference: true,
    }) as PrototypicalDataState

    const to = resolvePath(
        environment,
        animation.outputSpecifier,
        `${animation.id}_To(${accessorsToString(animation.outputSpecifier)})`
    )

    // Create movement path
    const movement: PrototypicalPath = createPrototypicalMovementPath(
        animation.inputSpecifier,
        animation.outputSpecifier,
        `Movement${animation.id}`
    )
    addPrototypicalPath(environment, movement)

    // Create placement path
    const placement: PrototypicalPath = createPrototypicalPlacementPath(
        animation.inputSpecifier,
        animation.outputSpecifier,
        `Placement${animation.id}`
    )
    addPrototypicalPath(environment, placement)

    // Begin movement
    beginPrototypicalPath(movement, view.environment)
}

function onSeek(animation: MoveAndPlaceAnimation, view: RootViewState, time: number, options: AnimationRuntimeOptions) {
    let t = animation.ease(time / duration(animation))

    const environment = view.environment
    const tn = time / duration(animation)

    // Move
    if (tn <= 0.7 && !animation.noMove) {
        let t = animation.ease(remap(tn, 0, 0.7, 0, 1))

        const movement = lookupPrototypicalPathById(environment, `Movement${animation.id}`) as PrototypicalMovementPath
        seekPrototypicalPath(movement, environment, t)
    }
    // TODO BEGIN PLACE AND END MOVEMENT
    // Place
    else if (tn >= 0.8 || animation.noMove) {
        let t: number

        if (animation.noMove) {
            t = animation.ease(tn)
        } else {
            t = animation.ease(remap(tn, 0.8, 1, 0, 1))
        }

        const placement = lookupPrototypicalPathById(
            environment,
            `Placement${animation.id}`
        ) as PrototypicalPlacementPath
        seekPrototypicalPath(placement, environment, t)
    }

    updateRootViewLayout(view)
}

function onEnd(animation: MoveAndPlaceAnimation, view: RootViewState, options: AnimationRuntimeOptions) {
    const environment = view.environment

    // Paths
    const movement = lookupPrototypicalPathById(environment, `Movement${animation.id}`) as PrototypicalMovementPath
    const placement = lookupPrototypicalPathById(environment, `Placement${animation.id}`) as PrototypicalPlacementPath

    // End placement
    endPrototypicalPath(placement, environment)

    // Remove paths from environment
    removePrototypicalPath(environment, `Movement${animation.id}`)
    removePrototypicalPath(environment, `Placement${animation.id}`)

    const input = resolvePath(environment, animation.inputSpecifier, null, null, {
        noResolvingReference: true,
    }) as PrototypicalDataState
    const to = resolvePath(environment, animation.outputSpecifier, `${animation.id}_EndTo`)

    if (instanceOfPrototypicalEnvironment(to)) {
        if (options.baking) {
            computeReadAndWrites(
                animation,
                {
                    location: getMemoryLocation(environment, input).foundLocation,
                    id: input.id,
                },
                null
            )
        }
    } else {
        if (options.baking) {
            computeReadAndWrites(
                animation,
                {
                    location: getMemoryLocation(environment, input).foundLocation,
                    id: input.id,
                },
                { location: getMemoryLocation(environment, to).foundLocation, id: to.id }
            )
        }

        removeAt(environment, getMemoryLocation(environment, input).foundLocation)

        if (instanceOfPrototypicalData(to)) {
            replacePrototypicalDataWith(to, input, { frame: true, id: true })
        }
    }

    updateRootViewLayout(view)
}

function computeReadAndWrites(animation: MoveAndPlaceAnimation, inputData: AnimationData, outputData: AnimationData) {
    animation._reads = [inputData]
    animation._writes = outputData ? [outputData, inputData] : [inputData]
}

export function moveAndPlaceAnimation(
    inputSpecifier: Accessor[],
    outputSpecifier: Accessor[],
    noMove: boolean = false,
    options: AnimationOptions = {}
): MoveAndPlaceAnimation {
    return {
        ...createAnimationNode(null, { ...options, duration: noMove ? 30 : 60 }),
        _name: 'MoveAndPlaceAnimation',

        name: `Move data at ${accessorsToString(inputSpecifier)} onto ${accessorsToString(outputSpecifier)}`,

        // Attributes
        inputSpecifier,
        outputSpecifier,
        noMove,

        // Callbacks
        onBegin,
        onSeek,
        onEnd,
    }
}
