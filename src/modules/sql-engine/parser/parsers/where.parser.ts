import { WhereOperator } from '../../../storage/table-manager/table-manager.js';
import { Column } from '../../../storage/table-manager/table.dto.js';
import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    MultiCharacterOperatorToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import { AST, FromClause } from '../ast/ast.class.js';
import { WhereClauseAST } from '../ast/dml/where-clause.ast.js';
import { Parser } from '../parser.class.js';

export class WhereParser extends Parser {
    private whereAST: WhereClauseAST;
    private openParenthesesToken: Token[];

    constructor(tokens: Token[]) {
        super(tokens);
        this.whereAST = new WhereClauseAST();
        this.openParenthesesToken = [];
    }

    private parseOperand(
        from?: FromClause[],
        isLeftOperand: boolean = true,
    ): {
        operand: string | number | null | Column;
        isColumn: boolean;
        columnRef?: string;
    } {
        const operandInfo: {
            operand: string | number | null | Column;
            isColumn: boolean;
            columnRef?: string;
        } = {
            operand: null,
            isColumn: false,
            columnRef: undefined,
        };
        while (this.expect(new PunctuationToken('('))) {
            this.openParenthesesToken.push(this.peek()!);
            this.consume();
        }

        if (
            from !== undefined &&
            this.next() !== null &&
            this.next()?.equals(new PunctuationToken('.'))
        ) {
            const ColRefToken = this.peek();
            if (
                ColRefToken === null ||
                ColRefToken.type !== TokenType.IDENTIFIER
            ) {
                this.whereAST.missedTokenError(
                    'Column reference identifier',
                    ColRefToken?.value || null,
                    ColRefToken?.position || null,
                );
            }
            this.consume();
            operandInfo.columnRef = from.find(
                (tbl) =>
                    tbl.alias === ColRefToken.value ||
                    tbl.tableName === ColRefToken.value,
            )?.tableName;

            if (!operandInfo.columnRef) {
                throw new SyntaxErrorException(
                    `Column reference '${ColRefToken.value}' does not match any table alias or name in the FROM clause at ${ColRefToken.position}.`,
                );
            }
            this.consume(); // Consume the '.' token
        }

        const token = this.peek();
        if (
            !token ||
            (token.type !== TokenType.IDENTIFIER &&
                token.type !== TokenType.LITERAL &&
                token.type !== TokenType.NUMBER &&
                token.type !== TokenType.KEYWORD)
        ) {
            this.whereAST.missedTokenError(
                isLeftOperand ? 'left_operand' : 'right_operand',
                token ? token.value : null,
                token ? token.position : null,
                'WHERE',
            );
        }
        if (token.equals(new KeywordToken('NULL')) && isLeftOperand) {
            throw new SyntaxErrorException(
                `Unexpected token 'NULL' at ${token.position}. 'NULL' cannot be used as a left operand in a WHERE condition.`,
            );
        } else if (token.type === TokenType.LITERAL) {
            operandInfo.operand = token.value.slice(1, -1); // Remove the surrounding quotes
        } else if (token.type === TokenType.NUMBER) {
            operandInfo.operand = Number(token.value);
        } else if (
            token.equals(new KeywordToken('TRUE')) ||
            token.equals(new KeywordToken('FALSE'))
        ) {
            operandInfo.operand = token.equals(new KeywordToken('TRUE'))
                ? 1
                : 0;
        } else if (token.type === TokenType.IDENTIFIER) {
            operandInfo.operand = token.value;
            operandInfo.isColumn = true;
        } else {
            this.whereAST.missedTokenError(
                'VALUE',
                token.value,
                token.position,
                `${token.value} =`,
            );
        }

        this.consume(); // Consume operand token

        while (this.expect(new PunctuationToken(')'))) {
            if (this.openParenthesesToken.length === 0) {
                const foundToken = this.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            this.openParenthesesToken.pop();
            this.consume(); // Consume the ')' token
        }

        return operandInfo;
    }

    public parse(from?: FromClause[]): WhereClauseAST | null {
        while (this.expect(new PunctuationToken('('))) {
            this.openParenthesesToken.push(this.peek()!);
            this.consume(); // Consume the '(' token
        }

        const leftOperandInfo = this.parseOperand(from);
        this.whereAST.leftOperand = leftOperandInfo.operand;
        this.whereAST.isLeftOperandColumn = leftOperandInfo.isColumn;
        this.whereAST.leftColumnRef = leftOperandInfo.columnRef;

        const operatorToken = this.peek();

        if (
            !operatorToken ||
            (operatorToken.type !== TokenType.SINGLE_CHARACTER_OPERATOR &&
                operatorToken.type !== TokenType.MULTI_CHARACTER_OPERATOR &&
                operatorToken.equals(new KeywordToken('IS')) === false)
        ) {
            this.whereAST.missedTokenError(
                'operator',
                operatorToken ? operatorToken.value : null,
                operatorToken ? operatorToken.position : null,
                `${this.whereAST.leftOperand}`,
            );
        }

        switch (true) {
            case operatorToken.equals(new SingleCharacterOperatorToken('=')):
                this.whereAST.operator = WhereOperator.EQUALS;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('>')):
                this.whereAST.operator = WhereOperator.GREATER_THAN;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('<')):
                this.whereAST.operator = WhereOperator.LESS_THAN;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('>=')):
                this.whereAST.operator = WhereOperator.GREATER_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('<=')):
                this.whereAST.operator = WhereOperator.LESS_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('!=')):
                this.whereAST.operator = WhereOperator.NOT_EQUALS;
                break;
            case operatorToken.equals(new KeywordToken('IS')):
                this.consume(); // Consume the 'IS' operator token2
                this.whereAST.operator = WhereOperator.EQUALS;
                if (
                    this.next() !== null &&
                    this.next()?.equals(new KeywordToken('NOT'))
                ) {
                    this.whereAST.operator = WhereOperator.NOT_EQUALS;
                    this.consume(); // Consume the 'NOT' token
                }

                if (!this.expect(new KeywordToken('NULL'))) {
                    this.whereAST.missedTokenError(
                        'NULL',
                        this.peek() ? this.peek()!.value : null,
                        this.peek() ? this.peek()!.position : null,
                        `${this.whereAST.leftOperand} IS${
                            this.whereAST.operator === WhereOperator.NOT_EQUALS
                                ? ' NOT'
                                : ''
                        }`,
                    );
                }
                this.whereAST.rightOperand = null;
                this.whereAST.isRightOperandColumn = false;
                this.consume(); // Consume the 'NULL' token

                while (this.expect(new PunctuationToken(')'))) {
                    if (this.openParenthesesToken.length === 0) {
                        const foundToken = this.peek();
                        throw new SyntaxErrorException(
                            `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                        );
                    }
                    this.openParenthesesToken.pop();
                    this.consume(); // Consume the ')' token
                }

                return this.whereAST;
            default:
                this.whereAST.missedTokenError(
                    'OPERATOR',
                    operatorToken ? operatorToken.value : null,
                    operatorToken ? operatorToken.position : null,
                    `${this.whereAST.leftOperand}`,
                );
        }

        this.consume(); // Consume the operator token

        const rightOperandInfo = this.parseOperand(from, false);
        this.whereAST.rightOperand = rightOperandInfo.operand;
        this.whereAST.isRightOperandColumn = rightOperandInfo.isColumn;
        this.whereAST.rightColumnRef = rightOperandInfo.columnRef;

        while (this.expect(new PunctuationToken(')'))) {
            if (this.openParenthesesToken.length === 0) {
                const foundToken = this.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            this.openParenthesesToken.pop();
            this.consume(); // Consume the ')' token
        }

        if (this.openParenthesesToken.length > 0) {
            if (!this.expect(new PunctuationToken(')'))) {
                throw new SyntaxErrorException(
                    `Detected an opening parenthesis '(' at ${this.openParenthesesToken[0].position} but no corresponding closing parenthesis ')' was found.`,
                );
            }
        }

        return this.whereAST;
    }
}
