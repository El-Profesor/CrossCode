import * as ESTree from 'estree';
import { Accessor, AccessorType, Data, DataType } from '../../../environment/Data';
import { Environment } from '../../../environment/Environment';
import { lerp } from '../../../utilities/math';
import { AnimationNode, AnimationOptions } from '../AnimationNode';

export default class BinaryExpressionSetup extends AnimationNode {
    leftSpecifier: Accessor[];
    rightSpecifier: Accessor[];
    operator: ESTree.BinaryOperator;

    constructor(
        leftSpecifier: Accessor[],
        rightSpecifier: Accessor[],
        operator: ESTree.BinaryOperator,
        options: AnimationOptions = {}
    ) {
        super(options);

        this.leftSpecifier = leftSpecifier;
        this.rightSpecifier = rightSpecifier;

        this.operator = operator;
    }

    begin(environment: Environment) {
        // Find left data
        let left = environment.resolvePath(this.leftSpecifier) as Data;
        if (left.type == DataType.ID) {
            left = environment.resolve({
                type: AccessorType.ID,
                value: left.value as string,
            }) as Data;
        }
        environment._temps[`LeftData${this.id}`] = [{ type: AccessorType.ID, value: left.id }];

        // Find right data
        let right = environment.resolvePath(this.rightSpecifier) as Data;
        if (right.type == DataType.ID) {
            right = environment.resolve({
                type: AccessorType.ID,
                value: right.value as string,
            }) as Data;
        }
        environment._temps[`RightData${this.id}`] = [{ type: AccessorType.ID, value: right.id }];

        // Target left transform
        environment._temps[`LeftTransform${this.id}`] = {
            init_x: left.transform.x,
            init_y: left.transform.y,
            x: (left.transform.x + right.transform.x) / 2 - 25,
            y: (left.transform.y + right.transform.y) / 2 - 5,
        };

        // Target right transform
        environment._temps[`RightTransform${this.id}`] = {
            init_x: right.transform.x,
            init_y: right.transform.y,
            x: (left.transform.x + right.transform.x) / 2 + 25,
            y: (left.transform.y + right.transform.y) / 2 - 5,
        };
    }

    seek(environment: Environment, time: number) {
        let t = super.ease(time / this.duration);

        const left = environment.resolvePath(environment._temps[`LeftData${this.id}`]) as Data;
        const right = environment.resolvePath(environment._temps[`RightData${this.id}`]) as Data;

        const leftTransform = environment._temps[`LeftTransform${this.id}`];
        const rightTransform = environment._temps[`RightTransform${this.id}`];

        // Move left
        left.transform.x = lerp(leftTransform.init_x, leftTransform.x, t);
        left.transform.y = lerp(leftTransform.init_y, leftTransform.y, t);

        // Move right
        right.transform.x = lerp(rightTransform.init_x, rightTransform.x, t);
        right.transform.y = lerp(rightTransform.init_y, rightTransform.y, t);
    }

    end(environment: Environment) {
        this.seek(environment, this.duration);
    }
}
