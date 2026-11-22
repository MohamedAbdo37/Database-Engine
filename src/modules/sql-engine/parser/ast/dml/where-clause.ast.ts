import { Catalog } from '../../../../storage/dto/catalog.dto.js';
import { Datatype } from '../../../../storage/dto/datatype.dto.js';
import { WhereOperator } from '../../../../storage/table-manager/table-manager.js';
import { Column } from '../../../../storage/table-manager/table.dto.js';
import { ExecutionErrorException } from '../../../exceptions/execution-error.exc.js';
import { SyntaxErrorException } from '../../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    MultiCharacterOperatorToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
    TokenType,
} from '../../../tokenizer/token.class.js';
import { ParserGenerator } from '../../parser.js';
import { FromClause, SubClassAST } from '../ast.class.js';

export class WhereClauseAST extends SubClassAST {
    leftOperand: string | number | null | Column;
    isLeftOperandColumn: boolean;
    leftColumnRef?: string;
    operator: WhereOperator;
    rightOperand: string | number | null | Column;
    isRightOperandColumn: boolean;
    rightColumnRef?: string;

    private openParenthesesToken: Token[];

    constructor() {
        super();
        this.leftOperand = null;
        this.isLeftOperandColumn = false;
        this.operator = WhereOperator.EQUALS;
        this.rightOperand = null;
        this.isRightOperandColumn = false;
        this.openParenthesesToken = [];
    }

    public static validateWhereOperandAsColumn(
        operand: string | number | null | Column,
        schema: Catalog,
    ): Column {
        if (operand === null) {
            throw new ExecutionErrorException(
                'Operand cannot be null when it is expected to be a column name.',
            );
        }

        if (typeof operand !== 'string') {
            throw new ExecutionErrorException(
                `Expected a column name as a string, but got '${typeof operand}'.`,
            );
        }

        const column = schema.getColumnByName(operand as string);
        if (!column) {
            throw new ExecutionErrorException(
                `Column '${operand}' does not exist in table '${schema.tableName}'.`,
            );
        }

        operand = {
            name: column.name,
            datatype: Datatype.getDatatypeInstance(
                column?.datatype,
                column.value,
            ),
            id: column.id,
            isPrimary: column.isPrimary,
            isUnique: column.isUnique,
        };

        return operand;
    }

    public parse(
        parser: ParserGenerator,
        from?: FromClause[],
    ): WhereClauseAST | null {
        while (parser.expect(new PunctuationToken('('))) {
            this.openParenthesesToken.push(parser.peek()!);
            parser.consume(); // Consume the '(' token
        }

        const leftOperandInfo = this.parseOperand(parser, from);
        this.leftOperand = leftOperandInfo.operand;
        this.isLeftOperandColumn = leftOperandInfo.isColumn;
        this.leftColumnRef = leftOperandInfo.columnRef;

        const operatorToken = parser.peek();

        if (
            !operatorToken ||
            (operatorToken.type !== TokenType.SINGLE_CHARACTER_OPERATOR &&
                operatorToken.type !== TokenType.MULTI_CHARACTER_OPERATOR &&
                operatorToken.equals(new KeywordToken('IS')) === false)
        ) {
            this.missedTokenError(
                'operator',
                operatorToken ? operatorToken.value : null,
                operatorToken ? operatorToken.position : null,
                `${this.leftOperand}`,
            );
        }

        switch (true) {
            case operatorToken.equals(new SingleCharacterOperatorToken('=')):
                this.operator = WhereOperator.EQUALS;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('>')):
                this.operator = WhereOperator.GREATER_THAN;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('<')):
                this.operator = WhereOperator.LESS_THAN;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('>=')):
                this.operator = WhereOperator.GREATER_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('<=')):
                this.operator = WhereOperator.LESS_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('!=')):
                this.operator = WhereOperator.NOT_EQUALS;
                break;
            case operatorToken.equals(new KeywordToken('IS')):
                parser.consume(); // Consume the 'IS' operator token2
                this.operator = WhereOperator.EQUALS;
                if (
                    parser.next() !== null &&
                    parser.next()?.equals(new KeywordToken('NOT'))
                ) {
                    this.operator = WhereOperator.NOT_EQUALS;
                    parser.consume(); // Consume the 'NOT' token
                }

                if (!parser.expect(new KeywordToken('NULL'))) {
                    this.missedTokenError(
                        'NULL',
                        parser.peek() ? parser.peek()!.value : null,
                        parser.peek() ? parser.peek()!.position : null,
                        `${this.leftOperand} IS${
                            this.operator === WhereOperator.NOT_EQUALS
                                ? ' NOT'
                                : ''
                        }`,
                    );
                }
                this.rightOperand = null;
                this.isRightOperandColumn = false;
                parser.consume(); // Consume the 'NULL' token

                while (parser.expect(new PunctuationToken(')'))) {
                    if (this.openParenthesesToken.length === 0) {
                        const foundToken = parser.peek();
                        throw new SyntaxErrorException(
                            `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                        );
                    }
                    this.openParenthesesToken.pop();
                    parser.consume(); // Consume the ')' token
                }

                return this;
            default:
                this.missedTokenError(
                    'OPERATOR',
                    operatorToken ? operatorToken.value : null,
                    operatorToken ? operatorToken.position : null,
                    `${this.leftOperand}`,
                );
        }

        parser.consume(); // Consume the operator token

        const rightOperandInfo = this.parseOperand(parser, from, false);
        this.rightOperand = rightOperandInfo.operand;
        this.isRightOperandColumn = rightOperandInfo.isColumn;
        this.rightColumnRef = rightOperandInfo.columnRef;

        while (parser.expect(new PunctuationToken(')'))) {
            if (this.openParenthesesToken.length === 0) {
                const foundToken = parser.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            this.openParenthesesToken.pop();
            parser.consume(); // Consume the ')' token
        }

        if (this.openParenthesesToken.length > 0) {
            if (!parser.expect(new PunctuationToken(')'))) {
                throw new SyntaxErrorException(
                    `Detected an opening parenthesis '(' at ${this.openParenthesesToken[0].position} but no corresponding closing parenthesis ')' was found.`,
                );
            }
        }

        return this;
    }

    private parseOperand(
        parser: ParserGenerator,
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
        while (parser.expect(new PunctuationToken('('))) {
            this.openParenthesesToken.push(parser.peek()!);
            parser.consume(); // Consume the '(' token
        }

        if (
            from !== undefined &&
            parser.next() !== null &&
            parser.next()?.equals(new PunctuationToken('.'))
        ) {
            const ColRefToken = parser.peek();
            if (
                ColRefToken === null ||
                ColRefToken.type !== TokenType.IDENTIFIER
            ) {
                this.missedTokenError(
                    'Column reference identifier',
                    ColRefToken?.value || null,
                    ColRefToken?.position || null,
                );
            }
            parser.consume(); // Consume operand token
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
            parser.consume(); // Consume the '.' token
        }

        const token = parser.peek();
        if (
            !token ||
            (token.type !== TokenType.IDENTIFIER &&
                token.type !== TokenType.LITERAL &&
                token.type !== TokenType.NUMBER &&
                token.type !== TokenType.KEYWORD)
        ) {
            this.missedTokenError(
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
            this.missedTokenError(
                'VALUE',
                token.value,
                token.position,
                `${token.value} =`,
            );
        }

        parser.consume(); // Consume operand token

        while (parser.expect(new PunctuationToken(')'))) {
            if (this.openParenthesesToken.length === 0) {
                const foundToken = parser.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            this.openParenthesesToken.pop();
            parser.consume(); // Consume the ')' token
        }

        return operandInfo;
    }
}
