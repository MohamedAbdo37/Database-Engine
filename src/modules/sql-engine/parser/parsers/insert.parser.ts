import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import { InsertAST, InsertRow } from '../ast/dml/insert.ast.js';
import { Parser } from '../parser.class.js';

export class InsertParser extends Parser {
    private insertAST: InsertAST;
    constructor(tokens: Token[]) {
        super(tokens);
        this.insertAST = new InsertAST();
    }

    private parseColumnsNames() {
        this.consume();
        let columnNameToken = this.peek();
        while (
            columnNameToken !== null &&
            columnNameToken.type === TokenType.IDENTIFIER
        ) {
            this.insertAST.columns.push(columnNameToken.value);
            this.consume();

            if (this.expect(new PunctuationToken(')'))) {
                break;
            } else if (
                !this.expect(new PunctuationToken(',')) &&
                this.peek() !== null &&
                this.peek()?.type === TokenType.IDENTIFIER
            ) {
                this.insertAST.missedTokenError(
                    ',',
                    this.peek()?.type ?? null,
                    this.peek()?.position ?? null,
                );
            }
            this.consume(); // consume ','
            columnNameToken = this.peek();
        }

        if (!this.expect(new PunctuationToken(')'))) {
            this.insertAST.missedTokenError(
                ')',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        this.consume(); // consume ')'
    }

    private parseRowValues() {
        if (!this.expect(new PunctuationToken('('))) {
            this.insertAST.missedTokenError(
                '(',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        this.consume(); // consume '('

        const row: InsertRow = { columns: [] };
        let id = 0;
        while (!this.expect(new PunctuationToken(')'))) {
            if (
                this.insertAST.columns.length > 0 &&
                id >= this.insertAST.columns.length
            ) {
                throw new SyntaxErrorException(
                    `Too many values provided for the INSERT statement. Expected ${this.insertAST.columns.length} values, but got more.`,
                );
            }

            const valueToken = this.peek();
            if (valueToken === null) {
                throw new SyntaxErrorException(
                    'Expected a value in INSERT row, but found end of input.',
                );
            }

            let value: string | number | null = null;
            let isNullable = false;
            if (this.expect(new KeywordToken('NULL'))) {
                value = null;
                isNullable = true;
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
                throw new SyntaxErrorException(
                    `Expected a value in INSERT row, but found '${valueToken.value}' at ${valueToken.position}.`,
                );
            }

            this.consume();

            row.columns.push({
                name: this.insertAST.columns[id],
                value,
                isNullable,
            });
            id++;

            if (this.expect(new PunctuationToken(','))) {
                this.consume();
                if (this.expect(new PunctuationToken(')'))) {
                    throw new SyntaxErrorException(
                        'Expected a value after comma in INSERT row.',
                    );
                }
                continue;
            }

            if (!this.expect(new PunctuationToken(')'))) {
                throw new SyntaxErrorException(
                    `Expected ',' or ')' after INSERT value, but found '${this.peek()?.value ?? 'end of input'}'.`,
                );
            }
        }

        if (
            this.insertAST.columns.length > 0 &&
            id !== this.insertAST.columns.length
        ) {
            throw new SyntaxErrorException(
                `Too few values provided for the INSERT statement. Expected ${this.insertAST.columns.length} values, but got ${id}.`,
            );
        }

        this.consume();
        this.insertAST.rows.push(row);
    }

    public parse(): InsertAST | null {
        this.consume();

        if (!this.expect(new KeywordToken('INTO'))) {
            this.insertAST.missedTokenError(
                'INTO',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        this.consume(); // consume INTO
        const tableNameToken = this.peek();
        if (
            tableNameToken === null ||
            tableNameToken.type !== TokenType.IDENTIFIER
        ) {
            this.insertAST.missedTokenError(
                'table name',
                tableNameToken?.type ?? null,
                tableNameToken?.position ?? null,
            );
        }

        this.insertAST.tableName = tableNameToken!.value;
        this.consume();

        if (this.expect(new PunctuationToken('('))) {
            this.parseColumnsNames();
        } else {
            this.insertAST.missedTokenError(
                'column list',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        if (!this.expect(new KeywordToken('VALUES'))) {
            this.insertAST.missedTokenError(
                'VALUES',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        this.consume(); // consume VALUES

        while (
            this.peek() !== null &&
            !this.expect(new PunctuationToken(';'))
        ) {
            this.parseRowValues();

            if (this.expect(new PunctuationToken(','))) {
                this.consume();
            } else if (!this.expect(new PunctuationToken(';'))) {
                this.insertAST.missedTokenError(
                    "',' or ';'",
                    this.peek()?.type ?? null,
                    this.peek()?.position ?? null,
                );
            }
        }

        if (!this.expect(new PunctuationToken(';'))) {
            this.insertAST.missedTokenError(
                ';',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }
        this.consume();

        if (this.peek() !== null) {
            throw new SyntaxErrorException(
                `Unexpected token '${this.peek()?.value}' after INSERT statement at ${this.peek()?.position}.`,
            );
        }
        return this.insertAST;
    }
}
