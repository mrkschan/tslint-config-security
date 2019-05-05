import * as Lint from 'tslint';
import * as ts from 'typescript';
import {stringLiteralKinds} from '../node-kind';

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: 'tsr-detect-child-process',
        description: 'Warns when child_process.exec() with non-literal first argument is used',
        descriptionDetails: Lint.Utils.dedent`Any usage of child_process.exec()
            with non-literal first argument will trigger a warning.
            See https://github.com/webschik/tslint-config-security#tsr-detect-child-process`,
        optionsDescription: '',
        options: null,
        type: 'functionality',
        requiresTypeInfo: false,
        typescriptOnly: false
    };

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>) {
    const names: string[] = [];

    function visitNode(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.CallExpression: {
                const {expression, arguments: args} = node as ts.CallExpression;
                const firstArgument = args && args[0];

                if (
                    firstArgument &&
                    expression &&
                    stringLiteralKinds.includes(firstArgument.kind) &&
                    (firstArgument as ts.StringLiteral).text === 'child_process' &&
                    (expression as ts.StringLiteral).text === 'require'
                ) {
                    const parent: ts.VariableDeclaration = node.parent as ts.VariableDeclaration;

                    names.length = 0;

                    if (parent && parent.kind === ts.SyntaxKind.VariableDeclaration) {
                        names.push((parent.name as ts.Identifier).text);
                    }

                    ctx.addFailureAtNode(node, 'Found require("child_process")');
                }
                break;
            }
            case ts.SyntaxKind.ImportDeclaration: {
                const {moduleSpecifier} = node as ts.ImportDeclaration;

                if ((moduleSpecifier as ts.StringLiteral).text === 'child_process') {
                    ctx.addFailureAtNode(node, 'Found import "child_process"');
                }
                break;
            }
            case ts.SyntaxKind.PropertyAccessExpression: {
                const {name, expression} = node as ts.PropertyAccessExpression;

                if (
                    name &&
                    expression &&
                    name.text === 'exec' &&
                    names.indexOf((expression as ts.Identifier).text) >= 0
                ) {
                    ctx.addFailureAtNode(node, 'Found child_process.exec() with non StringLiteral first argument');
                }
                break;
            }
            default:
            //
        }

        return ts.forEachChild(node, visitNode);
    }

    return ts.forEachChild(ctx.sourceFile, visitNode);
}
