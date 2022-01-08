import {
    AccessorType,
    PrototypicalEnvironmentState,
} from '../../../../environment/EnvironmentState'
import {
    addPrototypicalPath,
    beginPrototypicalPath,
    endPrototypicalPath,
    lookupPrototypicalPathById,
    removePrototypicalPath,
    seekPrototypicalPath,
} from '../../../../path/path'
import {
    createPrototypicalCreateArrayPath,
    PrototypicalCreateArrayPath,
} from '../../../../path/prototypical/PrototypicalCreateArrayPath'
import { PrototypicalCreatePath } from '../../../../path/prototypical/PrototypicalCreatePath'
import { duration } from '../../../animation'
import { TransitionAnimationNode } from '../../../graph/abstraction/Transition'
import {
    AnimationData,
    AnimationRuntimeOptions,
} from '../../../graph/AnimationGraph'
import { AnimationOptions, createAnimationNode } from '../../AnimationNode'

export interface TransitionCreateArray extends TransitionAnimationNode {}

function onBegin(
    animation: TransitionCreateArray,
    view: PrototypicalEnvironmentState,
    options: AnimationRuntimeOptions
) {
    const environment = view

    let create = lookupPrototypicalPathById(
        environment,
        `CreateArray${animation.id}`
    ) as PrototypicalCreateArrayPath

    if (create == null) {
        create = createPrototypicalCreateArrayPath(
            [{ type: AccessorType.ID, value: animation.output.id }],
            [{ type: AccessorType.ID, value: animation.output.id }],
            `CreateArray${animation.id}`
        )
        addPrototypicalPath(environment, create)
        beginPrototypicalPath(create, environment)
    }
}

function onSeek(
    animation: TransitionCreateArray,
    view: PrototypicalEnvironmentState,
    time: number,
    options: AnimationRuntimeOptions
) {
    let t = animation.ease(time / duration(animation))
    const environment = view

    const create = lookupPrototypicalPathById(
        environment,
        `CreateArray${animation.id}`
    ) as PrototypicalCreatePath
    seekPrototypicalPath(create, environment, t)
}

function onEnd(
    animation: TransitionCreateArray,
    view: PrototypicalEnvironmentState,
    options: AnimationRuntimeOptions
) {
    const environment = view
    const create = lookupPrototypicalPathById(
        environment,
        `CreateArray${animation.id}`
    ) as PrototypicalCreateArrayPath
    endPrototypicalPath(create, environment)
    removePrototypicalPath(environment, `Create${animation.id}`)
}

function applyInvariant(
    animation: TransitionCreateArray,
    view: PrototypicalEnvironmentState
) {
    const environment = view

    let create = lookupPrototypicalPathById(
        environment,
        `CreateArray${animation.id}`
    ) as PrototypicalCreateArrayPath

    if (create == null) {
        create = createPrototypicalCreateArrayPath(
            [{ type: AccessorType.ID, value: animation.output.id }],
            [{ type: AccessorType.ID, value: animation.output.id }],
            `CreateArray${animation.id}`
        )
        addPrototypicalPath(environment, create)
        beginPrototypicalPath(create, environment)
    }
}

export function transitionCreateArray(
    output: AnimationData,
    origins: AnimationData[],
    options: AnimationOptions = {}
): TransitionCreateArray {
    return {
        ...createAnimationNode(null, { ...options }),

        name: 'TransitionCreateArray',

        output,
        origins,

        // Callbacks
        onBegin,
        onSeek,
        onEnd,

        // Transition
        applyInvariant,
    }
}
