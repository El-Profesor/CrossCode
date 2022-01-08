import { PrototypicalEnvironmentState } from '../../../environment/EnvironmentState'
import { clone } from '../../../utilities/objects'
import {
    AnimationNode,
    instanceOfAnimationNode,
} from '../../primitive/AnimationNode'
import { initializeTransitionAnimation } from '../../primitive/Transition/InitializeTransitionAnimation'
import { transitionCreateArray } from '../../primitive/Transition/Operations/CreateArrayTransitionAnimation'
import { transitionCreateReference } from '../../primitive/Transition/Operations/CreateReferenceTransitionAnimation'
import { transitionCreate } from '../../primitive/Transition/Operations/CreateTransitionAnimation'
import { transitionCreateVariable } from '../../primitive/Transition/Operations/CreateVariableTransitionAnimation'
import { transitionMove } from '../../primitive/Transition/Operations/MoveTransitionAnimation'
import { transitionPlace } from '../../primitive/Transition/Operations/PlaceTransitionAnimation'
import {
    AnimationData,
    AnimationGraph,
    createAnimationGraph,
} from '../AnimationGraph'
import {
    addVertex,
    AnimationTraceChain,
    AnimationTraceOperator,
    getChunkTrace,
} from '../graph'
import { AbstractionSelection } from './Abstractor'

export interface TransitionAnimationNode extends AnimationNode {
    applyInvariant: (
        animation: TransitionAnimationNode,
        view: PrototypicalEnvironmentState
    ) => void
    output: AnimationData
    origins: AnimationData[]
}

export function createTransitionAnimationFromSelection(
    node: AnimationNode | AnimationGraph,
    selection: AbstractionSelection
) {
    if (instanceOfAnimationNode(node)) {
        return clone(node)
    }

    if (selection.selection == null) {
        return createTransition(node)
    }

    const nodeData = { ...clone(node.nodeData), type: 'Transition' }
    const transition = createAnimationGraph(nodeData)
    transition.id = `Transition(${node.id})`

    transition.precondition = node.precondition
    transition.postcondition = node.postcondition

    for (const item of selection.selection) {
        const vertex = node.vertices.find((v) => v.id == item.id)
        const animation = createTransitionAnimationFromSelection(vertex, item)
        addVertex(transition, animation, { nodeData: animation.nodeData })
    }

    return transition
}

/**
 * Creates an animation from a graph
 * @param node
 * @returns
 */
export function createTransition(node: AnimationNode | AnimationGraph) {
    if (instanceOfAnimationNode(node)) {
        return clone(node)
    }

    const nodeData = { ...clone(node.nodeData), type: 'Transition' }
    const transition = createAnimationGraph(nodeData)
    transition.id = `Transition(${node.id})`

    const trace = getChunkTrace(node)
    // traceChainsToString(trace, true)
    const transitions = getTransitionsFromTrace(trace)

    // Chunk
    const nodes = node.vertices

    // Initialize to the post condition
    const init = initializeTransitionAnimation(
        clone(nodes[nodes.length - 1].postcondition)
    )
    init._reads = []
    init._writes = []

    addVertex(transition, init, {
        nodeData: { ...nodeData, type: 'Transition Animation' },
    })

    // Add all the transitions
    for (const t of transitions) {
        addVertex(transition, t, {
            nodeData: { ...nodeData, type: 'Transition Primitive' },
        })
    }

    transition.precondition = node.precondition
    transition.postcondition = node.postcondition

    // Make it parallel
    transition.isParallel = true
    transition.parallelStarts = [0, ...transitions.map((_) => 1)]

    return transition
}

function getTransitionsFromTrace(
    trace: AnimationTraceChain[]
): TransitionAnimationNode[] {
    const transitions: TransitionAnimationNode[] = []

    for (const chain of trace) {
        const [operations, leaves] = getAllOperationsAndLeaves(chain) // All operations and leaves (start output of data)

        if (operations.length == 0) {
            // No operations, meaning just preserve the data from previous
            continue
        }

        /*
        1. Find all branches of animation node, `X`
        2. If there is only one branch, `A` , and the leaf is a move, then `Move A -> X`
        3. If there are multiple branches, then `Create X`
            For each branch:
            1. If leaf is a create, then ignore
            2. If leaf is a move, then `Partial Move A -> X`
        */
        const branches = getAllBranches(chain)

        if (branches.length == 1) {
            // Create a new animation w.r.t the action that's there
            const transition = createTransitionAnimation(
                chain.value,
                operations[operations.length - 1],
                leaves.map((leaf) => leaf.value)
            )

            transitions.push(transition)
        } else {
            const create = createTransitionAnimation(
                chain.value,
                AnimationTraceOperator.CreateLiteral,
                leaves.map((leaf) => leaf.value)
            )

            transitions.push(create)

            // for (const branch of branches) {
            //     const [brachOperations, branchLeaves] =
            //         getAllOperationsAndLeaves(chain)

            //     const branchOperator =
            //         brachOperations[brachOperations.length - 1]

            //     if (
            //         branchOperator == AnimationTraceOperator.MoveAndPlace ||
            //         branchOperator == AnimationTraceOperator.CopyLiteral
            //     ) {
            //         const branchTransition = createTransitionAnimation(
            //             branch.value,
            //             branchOperator,
            //             branchLeaves.map((leaf) => leaf.value)
            //         )

            //         transitions.push(branchTransition)
            //     }
            // }
        }
    }

    // console.log(transitions.length)
    return transitions
}

function getAllBranches(
    chain: AnimationTraceChain,
    context: {
        parent: AnimationTraceChain
        operator: AnimationTraceOperator
    } = null
): AnimationTraceChain[] {
    // If no children, terminate the tree and return
    if (chain.children == null) {
        if (context == null) {
            return [chain]
        } else {
            let parent = clone(context.parent)
            let end = parent

            while (end.children != null) {
                end = end.children[0][1]
            }

            end.children = [
                [context.operator, { value: chain.value, children: null }],
            ]

            return [parent]
        }
    }

    let parent: AnimationTraceChain

    // Otherwise, build the context, first node
    if (context == null) {
        parent = { value: chain.value, children: null }
    } else {
        parent = clone(context.parent)
        let end = parent

        while (end.children != null && end.children.length > 0) {
            end = end.children[0][1]
        }

        end.children = [
            [context.operator, { value: chain.value, children: null }],
        ]
    }
    const branches: AnimationTraceChain[] = []

    for (const [operator, child] of chain.children) {
        branches.push(
            ...getAllBranches(child, { parent: parent, operator: operator })
        )
    }

    return branches
}

function getAllOperationsAndLeaves(
    chain: AnimationTraceChain
): [AnimationTraceOperator[], AnimationTraceChain[]] {
    if (chain.children == null) return [[], []]

    const operations: AnimationTraceOperator[] = []
    const leaves: AnimationTraceChain[] = []

    // TODO: Unique branches
    for (const child of chain.children) {
        const operator = child[0]
        const value = child[1]

        operations.push(operator)

        if (value.children == null) {
            leaves.push(value)
        }

        const [childOperations, childLeaves] = getAllOperationsAndLeaves(value)
        operations.push(...childOperations)
        leaves.push(...childLeaves)
    }

    return [operations, leaves]
}

function createTransitionAnimation(
    output: AnimationData,
    operation: AnimationTraceOperator,
    origins: AnimationData[]
): TransitionAnimationNode {
    const mapping = {
        [AnimationTraceOperator.MoveAndPlace]: transitionMove,
        [AnimationTraceOperator.CopyLiteral]: transitionMove,
        [AnimationTraceOperator.CreateLiteral]: transitionCreate,
        [AnimationTraceOperator.CreateArray]: transitionCreateArray,
        [AnimationTraceOperator.CreateReference]: transitionCreateReference,
        [AnimationTraceOperator.CreateVariable]: transitionCreateVariable,
        [AnimationTraceOperator.Place]: transitionPlace,
    }

    // Create the transition animation
    const transition: TransitionAnimationNode = mapping[operation](
        output,
        origins
    )

    transition._reads = [...origins.filter((o) => o != null)]
    transition._writes = output == null ? [] : [output]

    return transition
}
