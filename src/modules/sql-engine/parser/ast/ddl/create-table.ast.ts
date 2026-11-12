import { SyntaxErrorException } from '../../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    TokenType,
} from '../../../tokenizer/token.class.js';
import { ParserGenerator } from '../../parser.js';
import { AST, DDLType } from '../ast.class.js';
import { ColumnDefinition } from './column-definition.ast.js';
import { DDL } from './ddl.class.js';

export class CreateTableAST extends DDL {
    columns: ColumnDefinition[];
    ifNotExists: boolean;

    constructor() {
        super(DDLType.CREATE_TABLE);
    }

    addColumn(column: ColumnDefinition): void {
        if (!this.columns) {
            this.columns = [];
        }
        this.columns.push(column);
    }

    public parse(parser: ParserGenerator): AST {
        parser.consume();

        if (!parser.expect(new KeywordToken('TABLE'))) {
            const token = parser.peek();
            throw new SyntaxErrorException(
                `Expected 'TABLE' after 'CREATE', ` +
                    (token !== null
                        ? `but found '${token?.value}' at ${token?.position}.`
                        : 'but found end of input.'),
            );
        }
        parser.consume();

        const tableNameToken = parser.consume();
        if (tableNameToken === null || tableNameToken.type !== 'IDENTIFIER') {
            throw new SyntaxErrorException(
                `Expected table name after 'CREATE TABLE', ` +
                    (tableNameToken !== null
                        ? `but found '${tableNameToken.value}' at ${tableNameToken.position}.`
                        : 'but found end of input.'),
            );
        }
        this.tableName = tableNameToken.value;

        if (!parser.expect(new PunctuationToken('('))) {
            const token = parser.peek();
            throw new SyntaxErrorException(
                `Expected '(' after table name, ` +
                    (token !== null
                        ? `but found '${token?.value}' at ${token?.position}.`
                        : 'but found end of input.'),
            );
        }

        parser.consume();

        let token = parser.peek();

        if (token === null || parser.expect(new PunctuationToken(')'))) {
            throw new SyntaxErrorException(
                `Expected at least one column definition for table '${this.tableName}', ` +
                    (token !== null
                        ? `but found ')' at ${token.position}.`
                        : 'but found end of input.'),
            );
        }

        this.addColumn(
            new ColumnDefinition().parse(parser) as ColumnDefinition,
        );

        token = parser.peek();

        while (token?.equals(new PunctuationToken(','))) {
            parser.consume();
            this.addColumn(
                new ColumnDefinition().parse(parser) as ColumnDefinition,
            );
            token = parser.peek();
        }

        if (token !== null && token.type === TokenType.IDENTIFIER) {
            throw new SyntaxErrorException(
                `Expected ',' after column definition for table '${this.tableName}', ` +
                    `but found '${token.value}' at ${token.position}.`,
            );
        }

        if (token === null || !parser.expect(new PunctuationToken(')'))) {
            throw new SyntaxErrorException(
                `Expected ')' after column definitions for table '${this.tableName}', ` +
                    (token !== null
                        ? `but found '${token.value}' at ${token.position}.`
                        : 'but found end of input.'),
            );
        }

        parser.consume();

        if (!parser.expect(new KeywordToken(';'))) {
            const token = parser.peek();
            throw new SyntaxErrorException(
                `Expected ';' after CREATE TABLE statement, but found '${token?.value}' at ${token?.position}.`,
            );
        }

        parser.consume();

        if (parser.peek() !== null) {
            const token = parser.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${token?.value}' after CREATE TABLE statement at ${token?.position}.`,
            );
        }

        return this;
    }
}
