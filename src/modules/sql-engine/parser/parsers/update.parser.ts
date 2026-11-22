import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import { UpdateAST } from '../ast/dml/update.ast.js';
import { WhereClauseAST } from '../ast/dml/where-clause.ast.js';
import { Parser } from '../parser.class.js';
import { WhereParser } from './where.parser.js';

export class UpdateParser extends Parser {
    private updateAST: UpdateAST;
    constructor(tokens: Token[]) {
        super(tokens);
        this.updateAST = new UpdateAST();
    }

    private parseColumnAssignment(): void {
        const columnToken = this.peek();
        if (!columnToken || columnToken.type !== TokenType.IDENTIFIER) {
            this.updateAST.missedTokenError(
                'column_name',
                columnToken ? columnToken.value : null,
                columnToken ? columnToken.position : null,
            );
        }

        this.consume(); // Consume the column name token
        if (!this.expect(new SingleCharacterOperatorToken('='))) {
            const foundToken = this.peek();
            this.updateAST.missedTokenError(
                '=',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                `${columnToken.value}`,
            );
        }
        this.consume(); // Consume the '=' operator token

        const valueToken = this.peek();
        if (valueToken === null) {
            this.updateAST.missedTokenError(
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
            this.updateAST.missedTokenError(
                'VALUE',
                valueToken.value,
                valueToken.position,
                `${columnToken.value} =`,
            );
        }

        this.consume();
        this.updateAST.columns.push({
            column: columnToken.value,
            value,
            isNull,
        });
    }

    private parseCondition(): WhereClauseAST {
        const whereParser = new WhereParser(this.tokens);
        const remainingBefore = whereParser.tokens.length;
        const whereCondition = whereParser.parse() as WhereClauseAST;
        const consumed = remainingBefore - whereParser.tokens.length;

        this.consume(0, consumed);

        return whereCondition;
    }

    public parse(): UpdateAST | null {
        this.consume(); // Consume the 'UPDATE' keyword

        const tableToken = this.peek();
        if (!tableToken || tableToken.type !== TokenType.IDENTIFIER) {
            this.updateAST.missedTokenError(
                'TABLE_NAME',
                tableToken ? tableToken.value : null,
                tableToken ? tableToken.position : null,
                'UPDATE',
            );
        }

        this.updateAST.tableName = tableToken.value;
        this.consume(); // Consume the table name token

        if (!this.expect(new KeywordToken('SET'))) {
            const foundToken = this.peek();
            this.updateAST.missedTokenError(
                'SET',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                `UPDATE ${this.updateAST.tableName}`,
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

        if (this.updateAST.columns.length === 0) {
            throw new SyntaxErrorException(
                `Expected at least one column assignment in UPDATE statement, but found none.`,
            );
        }

        if (!this.expect(new KeywordToken('WHERE'))) {
            const foundToken = this.peek();
            this.updateAST.missedTokenError(
                'WHERE',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                'COLUMN_ASSIGNMENT',
            );
        }

        this.consume(); // Consume the 'WHERE' keyword

        this.updateAST.whereCondition = this.parseCondition();

        if (!this.expect(new PunctuationToken(';'))) {
            const foundToken = this.peek();
            this.updateAST.missedTokenError(
                ';',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                `WHERE ${this.updateAST.whereCondition.leftOperand} ${this.updateAST.whereCondition.operator} ${this.updateAST.whereCondition.rightOperand}`,
            );
        }

        this.consume(); // Consume the semicolon token

        if (this.peek() !== null) {
            const foundToken = this.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${foundToken?.value}' after UPDATE Statement at ${foundToken?.position}. Expected end of input.`,
            );
        }
        return this.updateAST;
    }
}
