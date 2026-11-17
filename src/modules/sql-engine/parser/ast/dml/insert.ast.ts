import { SyntaxErrorException } from '../../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
    TokenType,
} from '../../../tokenizer/token.class.js';
import { ParserGenerator } from '../../parser.js';
import { AST, DMLType } from '../ast.class.js';
import { DML } from './dml.class.js';

export interface InsertColumn {
    name: string;
    value: any;
    isNullable: boolean;
}

export interface InsertRow {
    columns: InsertColumn[];
}

export class InsertAST extends DML {
    columns: string[] = [];
    rows: InsertRow[] = [];
    private parser: ParserGenerator;

    private peek(): Token | null {
        return this.parser.peek();
    }

    private consume(): Token | null {
        return this.parser.consume();
    }

    private expect(token: Token): boolean {
        return this.parser.expect(token);
    }

    private parseColumnsNames() {
        this.consume();
        let columnNameToken = this.peek();
        while (
            columnNameToken !== null &&
            columnNameToken.type === TokenType.IDENTIFIER
        ) {
            this.columns.push(columnNameToken.value);
            this.consume();

            if (this.expect(new PunctuationToken(')'))) {
                break;
            } else if (
                !this.expect(new PunctuationToken(',')) &&
                this.peek() !== null &&
                this.peek()?.type === TokenType.IDENTIFIER
            ) {
                this.missedTokenError(
                    ',',
                    this.peek()?.type ?? null,
                    this.peek()?.position ?? null,
                );
            }
            this.consume(); // consume ','
            columnNameToken = this.peek();
        }

        if (!this.expect(new PunctuationToken(')'))) {
            this.missedTokenError(
                ')',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        this.consume(); // consume ')'
    }

    private parseRowValues() {
        if (!this.expect(new PunctuationToken('('))) {
            this.missedTokenError(
                '(',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        this.consume(); // consume '('

        const row: InsertRow = { columns: [] };
        let id = 0;
        while (!this.expect(new PunctuationToken(')'))) {
            if (id >= this.columns.length) {
                throw new SyntaxErrorException(
                    `Too many values provided for the INSERT statement. Expected ${this.columns.length} values, but got more.`,
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
                name: this.columns[id],
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

        if (id !== this.columns.length) {
            throw new SyntaxErrorException(
                `Too few values provided for the INSERT statement. Expected ${this.columns.length} values, but got ${id}.`,
            );
        }

        this.consume();
        this.rows.push(row);
    }

    constructor() {
        super(DMLType.INSERT);
    }

    public parse(parser: ParserGenerator): AST {
        this.parser = parser;
        this.consume(); // consume INSERT

        if (!this.expect(new KeywordToken('INTO'))) {
            this.missedTokenError(
                'INTO',
                this.peek()?.type ?? null,
                this.peek()?.position ?? null,
            );
        }

        this.consume(); // consume INTO
        const tableNameToken = this.peek();
        if (
            tableNameToken == null ||
            tableNameToken.type !== TokenType.IDENTIFIER
        ) {
            this.missedTokenError(
                'table name',
                tableNameToken?.type ?? null,
                tableNameToken?.position ?? null,
            );
        }

        this.tableName = tableNameToken.value;
        this.consume(); // consume table name

        if (this.expect(new PunctuationToken('('))) {
            this.parseColumnsNames();
        }

        if (!parser.expect(new KeywordToken('VALUES'))) {
            this.missedTokenError(
                'VALUES',
                parser.peek()?.type ?? null,
                parser.peek()?.position ?? null,
            );
        }

        parser.consume(); // consume VALUES

        while (
            parser.peek() !== null &&
            !parser.expect(new PunctuationToken(';'))
        ) {
            this.parseRowValues();

            if (parser.expect(new PunctuationToken(','))) {
                parser.consume();
            } else if (!parser.expect(new PunctuationToken(';'))) {
                this.missedTokenError(
                    "',' or ';'",
                    parser.peek()?.type ?? null,
                    parser.peek()?.position ?? null,
                );
            }
        }

        if (!parser.expect(new PunctuationToken(';'))) {
            this.missedTokenError(
                ';',
                parser.peek()?.type ?? null,
                parser.peek()?.position ?? null,
            );
        }
        parser.consume();

        if (this.peek() !== null) {
            throw new SyntaxErrorException(
                `Unexpected token '${this.peek()?.value}' after INSERT statement at ${this.peek()?.position}.`,
            );
        }
        return this;
    }
}
