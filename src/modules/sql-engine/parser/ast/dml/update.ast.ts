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
import { DML } from './dml.class.js';
import { WhereClauseAST } from './where-clause.ast.js';

export interface UpdateColumnAssignment {
    column: string;
    value: any;
    isNull: boolean;
}

export class UpdateAST extends DML {
    private parser: ParserGenerator;
    private _columns: UpdateColumnAssignment[] = [];

    private _whereCondition: WhereClauseAST;

    public get whereCondition(): WhereClauseAST {
        return this._whereCondition;
    }
    public set whereCondition(value: WhereClauseAST) {
        this._whereCondition = value;
    }

    public get columns(): UpdateColumnAssignment[] {
        return this._columns;
    }

    public set columns(value: UpdateColumnAssignment[]) {
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
        this._whereCondition = new WhereClauseAST().parse(
            this.parser,
        ) as WhereClauseAST;
    }

    public parse(parser: ParserGenerator): UpdateAST | null {
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
