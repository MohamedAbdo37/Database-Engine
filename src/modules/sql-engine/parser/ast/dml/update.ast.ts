import { WhereOperator } from '../../../../storage/table-manager/table-manager.js';
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
import { AST, DMLType } from '../ast.class.js';
import { DML, WhereCondition } from './dml.class.js';

export interface UpdateColumnAssignment {
    column: string;
    value: any;
    isNull: boolean;
}

export class UpdateAST extends DML {
    private parser: ParserGenerator;
    private _columns: UpdateColumnAssignment[] = [];

    private _whereCondition: WhereCondition;

    public get whereCondition(): WhereCondition {
        return this._whereCondition;
    }
    public set whereCondition(value: WhereCondition) {
        this._whereCondition = value;
    }

    public get columns(): { column: string; value: any; isNull: boolean }[] {
        return this._columns;
    }

    public set columns(
        value: { column: string; value: any; isNull: boolean }[],
    ) {
        this._columns = value;
    }

    constructor() {
        super(DMLType.UPDATE);
    }

    private peek(): Token | null {
        if (!this.parser) {
            throw new Error('Parser is not initialized.');
        }

        return this.parser.peek();
    }

    private next(): Token | null {
        if (!this.parser) {
            throw new Error('Parser is not initialized.');
        }

        return this.parser.next();
    }

    private consume(): Token | null {
        if (!this.parser) {
            throw new Error('Parser is not initialized.');
        }

        return this.parser.consume();
    }

    private expect(expectedToken: Token): boolean {
        if (!this.parser) {
            throw new Error('Parser is not initialized.');
        }

        return this.parser.expect(expectedToken);
    }

    private parseColumnAssignment(): void {
        const columnToken = this.peek();
        if (!columnToken || columnToken.type !== TokenType.IDENTIFIER) {
            this.missedTokenError(
                'column_name',
                columnToken ? columnToken.value : null,
                columnToken ? columnToken.position : null,
            );
        }

        this.consume(); // Consume the column name token
        if (!this.expect(new SingleCharacterOperatorToken('='))) {
            const foundToken = this.peek();
            this.missedTokenError(
                '=',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                `${columnToken.value}`,
            );
        }
        this.consume(); // Consume the '=' operator token

        const valueToken = this.peek();
        if (valueToken === null) {
            this.missedTokenError(
                'VALUE',
                null,
                null,
                `${columnToken.value} =`,
            );
        }

        let value: string | number | null = null;
        let isNull = false;
        if (this.expect(new KeywordToken('NULL'))) {
            value = null;
            isNull = true;
        } else if (valueToken.type === TokenType.LITERAL) {
            value = valueToken.value.slice(1, -1); // Remove the surrounding quotes
        } else if (valueToken.type === TokenType.NUMBER) {
            value = Number(valueToken.value);
        } else if (
            valueToken.equals(new KeywordToken('TRUE')) ||
            valueToken.equals(new KeywordToken('FALSE'))
        ) {
            value = valueToken.equals(new KeywordToken('TRUE')) ? 1 : 0;
        } else {
            this.missedTokenError(
                'VALUE',
                valueToken.value,
                valueToken.position,
                `${columnToken.value} =`,
            );
        }

        this.consume();
        this._columns.push({
            column: columnToken.value,
            value,
            isNull,
        });
    }

    private parseCondition(): void {
        const whereCondition: WhereCondition = {
            leftOperand: null,
            isLeftOperandColumn: false,
            leftColumnRef: undefined,
            operator: WhereOperator.EQUALS,
            rightOperand: null,
            isRightOperandColumn: false,
            rightColumnRef: undefined,
        };
        const openPrenticesToken: Token[] = [];
        while (this.expect(new PunctuationToken('('))) {
            openPrenticesToken.push(this.peek()!);
            this.consume(); // Consume the '(' token
        }

        const leftToken = this.peek();
        if (
            !leftToken ||
            (leftToken.type !== TokenType.IDENTIFIER &&
                leftToken.type !== TokenType.LITERAL &&
                leftToken.type !== TokenType.NUMBER &&
                leftToken.type !== TokenType.KEYWORD)
        ) {
            this.missedTokenError(
                'left_operand',
                leftToken ? leftToken.value : null,
                leftToken ? leftToken.position : null,
                'WHERE',
            );
        }
        if (leftToken.equals(new KeywordToken('NULL'))) {
            throw new SyntaxErrorException(
                `Unexpected token 'NULL' at ${leftToken.position}. 'NULL' cannot be used as a left operand in a WHERE condition.`,
            );
        } else if (leftToken.type === TokenType.LITERAL) {
            whereCondition.leftOperand = leftToken.value.slice(1, -1); // Remove the surrounding quotes
        } else if (leftToken.type === TokenType.NUMBER) {
            whereCondition.leftOperand = Number(leftToken.value);
        } else if (
            leftToken.equals(new KeywordToken('TRUE')) ||
            leftToken.equals(new KeywordToken('FALSE'))
        ) {
            whereCondition.leftOperand = leftToken.equals(
                new KeywordToken('TRUE'),
            )
                ? 1
                : 0;
        } else if (leftToken.type === TokenType.IDENTIFIER) {
            whereCondition.leftOperand = leftToken.value;
            whereCondition.isLeftOperandColumn = true;
        } else {
            this.missedTokenError(
                'VALUE',
                leftToken.value,
                leftToken.position,
                `${leftToken.value} =`,
            );
        }

        this.consume(); // Consume the left operand token

        while (this.expect(new PunctuationToken(')'))) {
            if (openPrenticesToken.length === 0) {
                const foundToken = this.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            openPrenticesToken.pop();
            this.consume(); // Consume the ')' token
        }

        const operatorToken = this.peek();

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
                `${whereCondition.leftOperand}`,
            );
        }

        switch (true) {
            case operatorToken.equals(new SingleCharacterOperatorToken('=')):
                whereCondition.operator = WhereOperator.EQUALS;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('>')):
                whereCondition.operator = WhereOperator.GREATER_THAN;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('<')):
                whereCondition.operator = WhereOperator.LESS_THAN;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('>=')):
                whereCondition.operator = WhereOperator.GREATER_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('<=')):
                whereCondition.operator = WhereOperator.LESS_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('!=')):
                whereCondition.operator = WhereOperator.NOT_EQUALS;
                break;
            case operatorToken.equals(new KeywordToken('IS')):
                this.consume(); // Consume the 'IS' operator token2
                whereCondition.operator = WhereOperator.EQUALS;
                if (
                    this.next() !== null &&
                    this.next()?.equals(new KeywordToken('NOT'))
                ) {
                    whereCondition.operator = WhereOperator.NOT_EQUALS;
                    this.consume(); // Consume the 'NOT' token
                }

                if (!this.expect(new KeywordToken('NULL'))) {
                    this.missedTokenError(
                        'NULL',
                        this.peek() ? this.peek()!.value : null,
                        this.peek() ? this.peek()!.position : null,
                        `${whereCondition.leftOperand} IS${
                            whereCondition.operator === WhereOperator.NOT_EQUALS
                                ? ' NOT'
                                : ''
                        }`,
                    );
                }
                whereCondition.rightOperand = null;
                whereCondition.isRightOperandColumn = false;
                this.whereCondition = whereCondition;
                this.consume(); // Consume the 'NULL' token

                while (this.expect(new PunctuationToken(')'))) {
                    if (openPrenticesToken.length === 0) {
                        const foundToken = this.peek();
                        throw new SyntaxErrorException(
                            `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                        );
                    }
                    openPrenticesToken.pop();
                    this.consume(); // Consume the ')' token
                }

                return; // Exit the function as we have handled the IS [NOT] NULL case
            default:
                this.missedTokenError(
                    'OPERATOR',
                    operatorToken ? operatorToken.value : null,
                    operatorToken ? operatorToken.position : null,
                    `${whereCondition.leftOperand}`,
                );
        }

        this.consume(); // Consume the operator token

        while (this.expect(new PunctuationToken('('))) {
            openPrenticesToken.push(this.peek()!);
            this.consume(); // Consume the '(' token
        }

        const rightToken = this.peek();

        if (
            !rightToken ||
            (rightToken.type !== TokenType.IDENTIFIER &&
                rightToken.type !== TokenType.LITERAL &&
                rightToken.type !== TokenType.NUMBER &&
                rightToken.type !== TokenType.KEYWORD)
        ) {
            this.missedTokenError(
                'left_operand',
                rightToken ? rightToken.value : null,
                rightToken ? rightToken.position : null,
                'WHERE',
            );
        }
        if (rightToken.equals(new KeywordToken('NULL'))) {
            throw new SyntaxErrorException(
                `Invalid NULL comparison at ${rightToken.position}. NULL must be compared using IS NULL or IS NOT NULL, not as a direct right-hand operand.`,
            );
        } else if (rightToken.type === TokenType.LITERAL) {
            whereCondition.rightOperand = rightToken.value.slice(1, -1); // Remove the surrounding quotes
        } else if (rightToken.type === TokenType.NUMBER) {
            whereCondition.rightOperand = Number(rightToken.value);
        } else if (
            rightToken.equals(new KeywordToken('TRUE')) ||
            rightToken.equals(new KeywordToken('FALSE'))
        ) {
            whereCondition.rightOperand = rightToken.equals(
                new KeywordToken('TRUE'),
            )
                ? 1
                : 0;
        } else if (rightToken.type === TokenType.IDENTIFIER) {
            whereCondition.rightOperand = rightToken.value;
            whereCondition.isRightOperandColumn = true;
        } else {
            this.missedTokenError(
                'VALUE',
                rightToken.value,
                rightToken.position,
                `${rightToken.value} =`,
            );
        }
        this.consume(); // Consume the right operand token

        while (this.expect(new PunctuationToken(')'))) {
            if (openPrenticesToken.length === 0) {
                const foundToken = this.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            openPrenticesToken.pop();
            this.consume(); // Consume the ')' token
        }

        if (openPrenticesToken.length > 0) {
            if (!this.expect(new PunctuationToken(')'))) {
                throw new SyntaxErrorException(
                    `Detected an opening parenthesis '(' at ${openPrenticesToken[0].position} but no corresponding closing parenthesis ')' was found.`,
                );
            }
        }

        this._whereCondition = whereCondition;
    }

    public parse(parser: ParserGenerator): AST | null {
        this.parser = parser;
        this.consume(); // Consume the 'UPDATE' keyword

        const tableToken = this.peek();
        if (!tableToken || tableToken.type !== TokenType.IDENTIFIER) {
            this.missedTokenError(
                'TABLE_NAME',
                tableToken ? tableToken.value : null,
                tableToken ? tableToken.position : null,
                'UPDATE',
            );
        }

        this.tableName = tableToken.value;
        this.consume(); // Consume the table name token

        if (!this.expect(new KeywordToken('SET'))) {
            const foundToken = this.peek();
            this.missedTokenError(
                'SET',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                `UPDATE ${this.tableName}`,
            );
        }
        this.consume(); // Consume the 'SET' keyword

        let nextToken = this.peek();
        while (nextToken !== null && nextToken.type === TokenType.IDENTIFIER) {
            this.parseColumnAssignment();
            nextToken = this.peek();

            if (
                nextToken === null ||
                !nextToken.equals(new PunctuationToken(','))
            ) {
                break; // Exit the loop if 'WHERE' is encountered
            }

            this.consume(); // Consume the comma token
            nextToken = this.peek();
        }

        if (this._columns.length === 0) {
            throw new SyntaxErrorException(
                `Expected at least one column assignment in UPDATE statement, but found none.`,
            );
        }

        if (!this.expect(new KeywordToken('WHERE'))) {
            const foundToken = this.peek();
            this.missedTokenError(
                'WHERE',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                'COLUMN_ASSIGNMENT',
            );
        }

        this.consume(); // Consume the 'WHERE' keyword

        this.parseCondition(); // Parse the WHERE condition

        if (!this.expect(new PunctuationToken(';'))) {
            const foundToken = this.peek();
            this.missedTokenError(
                ';',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                `WHERE ${this.whereCondition.leftOperand} ${this.whereCondition.operator} ${this.whereCondition.rightOperand}`,
            );
        }

        this.consume(); // Consume the semicolon token

        if (this.peek() !== null) {
            const foundToken = this.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${foundToken?.value}' after UPDATE Statement at ${foundToken?.position}. Expected end of input.`,
            );
        }

        return this; // Return the current AST node for further processing
    }
}
