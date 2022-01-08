import {
    clonePrototypicalData,
    createData,
    replacePrototypicalDataWith,
} from '../../../environment/data/data'
import {
    DataType,
    instanceOfPrototypicalData,
    PrototypicalDataState,
} from '../../../environment/data/DataState'
import {
    addDataAt,
    getMemoryLocation,
    removeAt,
    resolvePath,
} from '../../../environment/environment'
import {
    Accessor,
    PrototypicalEnvironmentState,
} from '../../../environment/EnvironmentState'
import {
    addPrototypicalPath,
    beginPrototypicalPath,
    endPrototypicalPath,
    lookupPrototypicalPathById,
    removePrototypicalPath,
    seekPrototypicalPath,
} from '../../../path/path'
import { createPrototypicalCreatePath } from '../../../path/prototypical/PrototypicalCreatePath'
import { PrototypicalElevationPath } from '../../../path/prototypical/PrototypicalElevationPath'
import { duration } from '../../animation'
import {
    AnimationData,
    AnimationRuntimeOptions,
} from '../../graph/AnimationGraph'
import {
    AnimationNode,
    AnimationOptions,
    createAnimationNode,
} from '../AnimationNode'

export interface GetMember extends AnimationNode {
    objectRegister: Accessor[]
    propertyRegister?: Accessor[] // Only if computed
    outputRegister: Accessor[]
}

function onBegin(
    animation: GetMember,
    view: PrototypicalEnvironmentState,
    options: AnimationRuntimeOptions
) {
    const environment = view

    // Get object
    const object = resolvePath(
        environment,
        animation.objectRegister,
        `${animation.id}_Object`
    ) as PrototypicalDataState
    console.assert(
        object.type === DataType.Array,
        `${animation.id}_Object is not an object`
    )

    // Get property
    const property = resolvePath(
        environment,
        animation.propertyRegister,
        `${animation.id}_Property`
    ) as PrototypicalDataState
    const propertyLocation = getMemoryLocation(
        environment,
        property
    ).foundLocation

    // Index into it
    const original = (object.value as PrototypicalDataState[])[
        property.value as number | string
    ]

    // console.log(object.value, property.value)

    let copy: PrototypicalDataState

    if (instanceOfPrototypicalData(original)) {
        // Create a copy of data
        copy = clonePrototypicalData(original, false, `${animation.id}_Copy`)
    } else {
        // Create a new data
        copy = createData(DataType.Literal, original, `${animation.id}_Copy`)
    }

    const location = addDataAt(environment, copy, [], null)
    environment._temps[`CopyMemberAnimation${animation.id}`] = location

    // Consume property
    removeAt(
        environment,
        getMemoryLocation(environment, property).foundLocation
    )

    // Remove object (reference)
    const objectReference = resolvePath(
        environment,
        animation.objectRegister,
        `${animation.id}_Object`,
        null,
        {
            noResolvingReference: true,
        }
    ) as PrototypicalDataState
    const objectLocation = getMemoryLocation(
        environment,
        objectReference
    ).foundLocation

    removeAt(
        environment,
        getMemoryLocation(environment, objectReference).foundLocation,
        {
            noResolvingReference: true,
        }
    )

    if (options.baking) {
        const propertyData = {
            location: propertyLocation,
            id: property.id,
        }

        const objectData = {
            location: objectLocation,
            id: objectReference.id,
        }

        const copyData = { location, id: copy.id }

        if (instanceOfPrototypicalData(original)) {
            computeReadAndWrites(
                animation,
                objectData,
                propertyData,
                copyData,
                {
                    location: getMemoryLocation(environment, original)
                        .foundLocation,
                    id: original.id,
                }
            )
        } else {
            computeReadAndWrites(animation, objectData, propertyData, copyData)
        }
    }

    // Point the output register to the newly created data
    const outputRegister = resolvePath(
        environment,
        animation.outputRegister,
        `${animation.id}_Floating`
    ) as PrototypicalDataState
    replacePrototypicalDataWith(
        outputRegister,
        createData(DataType.ID, copy.id, `${animation.id}_OutputRegister`)
    )

    // Create elevation path
    const elevation = createPrototypicalCreatePath(
        location,
        getMemoryLocation(environment, original).foundLocation,
        `Elevation${animation.id}`
    )
    addPrototypicalPath(environment, elevation)
    beginPrototypicalPath(elevation, environment)
}

function onSeek(
    animation: GetMember,
    view: PrototypicalEnvironmentState,
    time: number,
    options: AnimationRuntimeOptions
) {
    let t = animation.ease(time / duration(animation))

    const environment = view
    const copy = resolvePath(
        environment,
        environment._temps[`CopyMemberAnimation${animation.id}`],
        null
    ) as PrototypicalDataState
    const elevation = lookupPrototypicalPathById(
        environment,
        `Elevation${animation.id}`
    ) as PrototypicalElevationPath
    seekPrototypicalPath(elevation, environment, t)
}

function onEnd(
    animation: GetMember,
    view: PrototypicalEnvironmentState,
    options: AnimationRuntimeOptions
) {
    const environment = view
    const elevation = lookupPrototypicalPathById(
        environment,
        `Elevation${animation.id}`
    ) as PrototypicalElevationPath
    endPrototypicalPath(elevation, environment)

    removePrototypicalPath(environment, `Elevation${animation.id}`)
}

function computeReadAndWrites(
    animation: GetMember,
    obj: AnimationData,
    property: AnimationData,
    copy: AnimationData,
    original: AnimationData = null
) {
    animation._reads =
        original != null ? [original, obj, property] : [obj, property]
    animation._writes = [copy, obj]
}

export function getMember(
    objectRegister: Accessor[],
    propertyRegister: Accessor[],
    outputRegister: Accessor[],
    options: AnimationOptions = {}
): GetMember {
    return {
        ...createAnimationNode(null, options),
        _name: 'GetMember',

        name: 'GetMember',

        // Attributes
        objectRegister,
        propertyRegister,
        outputRegister,

        // Callbacks
        onBegin,
        onSeek,
        onEnd,
    }
}
