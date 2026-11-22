import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import { ColumnDefinition } from '../ast/ddl/column-definition.ast.js';
import { CreateTableAST } from '../ast/ddl/create-table.ast.js';
import { Parser } from '../parser.class.js';
import { ColumnDefinitionParser } from './column-definition.parser.js';

export class CreateParser extends Parser {
    constructor(tokens: Token[]) {
        super(tokens);
    }

    private parseColumnDefinition(): ColumnDefinition {
        const columnParser = new ColumnDefinitionParser(this.tokens);
        const remainingBefore = columnParser.tokens.length;
        const column = columnParser.parse();
        const consumed = remainingBefore - columnParser.tokens.length;

        this.consume(0, consumed);

        return column;
    }

    public parse(): CreateTableAST | null {
        const createTableAST = new CreateTableAST();
        this.consume();

        if (!this.expect(new KeywordToken('TABLE'))) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Expected 'TABLE' after 'CREATE', ` +
                    (token !== null
                        ? `but found '${token?.value}' at ${token?.position}.`
                        : 'but found end of input.'),
            );
        }
        this.consume();

        if (this.expect(new KeywordToken('IF'))) {
            this.consume();
            if (!this.expect(new KeywordToken('NOT'))) {
                const token = this.peek();
                throw new SyntaxErrorException(
                    `Expected 'NOT' after 'IF', ` +
                        (token !== null
                            ? `but found '${token?.value}' at ${token?.position}.`
                            : 'but found end of input.'),
                );
            }
            this.consume();

            if (!this.expect(new KeywordToken('EXISTS'))) {
                const token = this.peek();
                throw new SyntaxErrorException(
                    `Expected 'EXISTS' after 'IF NOT', ` +
                        (token !== null
                            ? `but found '${token?.value}' at ${token?.position}.`
                            : 'but found end of input.'),
                );
            }

            this.consume();
            createTableAST.ifNotExists = true;
        } else createTableAST.ifNotExists = false;

        const tableNameToken = this.consume();
        if (tableNameToken === null || tableNameToken.type !== 'IDENTIFIER') {
            throw new SyntaxErrorException(
                `Expected table name after ` +
                    (createTableAST.ifNotExists
                        ? `'CREATE TABLE IF NOT EXISTS', `
                        : `'CREATE TABLE', `) +
                    (tableNameToken !== null
                        ? `but found '${tableNameToken.value}' at ${tableNameToken.position}.`
                        : 'but found end of input.'),
            );
        }
        createTableAST.tableName = tableNameToken.value;

        if (!this.expect(new PunctuationToken('('))) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Expected '(' after table name, ` +
                    (token !== null
                        ? `but found '${token?.value}' at ${token?.position}.`
                        : 'but found end of input.'),
            );
        }

        this.consume();

        let token = this.peek();

        if (token === null || this.expect(new PunctuationToken(')'))) {
            throw new SyntaxErrorException(
                `Expected at least one column definition for table '${createTableAST.tableName}', ` +
                    (token !== null
                        ? `but found ')' at ${token.position}.`
                        : 'but found end of input.'),
            );
        }

        createTableAST.addColumn(this.parseColumnDefinition());

        token = this.peek();

        while (token?.equals(new PunctuationToken(','))) {
            this.consume();
            createTableAST.addColumn(this.parseColumnDefinition());
            token = this.peek();
        }

        if (token !== null && token.type === TokenType.IDENTIFIER) {
            throw new SyntaxErrorException(
                `Expected ',' after column definition for table '${createTableAST.tableName}', ` +
                    `but found '${token.value}' at ${token.position}.`,
            );
        }

        if (token === null || !this.expect(new PunctuationToken(')'))) {
            throw new SyntaxErrorException(
                `Expected ')' after column definitions for table '${createTableAST.tableName}', ` +
                    (token !== null
                        ? `but found '${token.value}' at ${token.position}.`
                        : 'but found end of input.'),
            );
        }

        this.consume();

        if (!this.expect(new PunctuationToken(';'))) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Expected ';' after CREATE TABLE statement, but found '${token?.value}' at ${token?.position}.`,
            );
        }

        this.consume();

        if (this.peek() !== null) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${token?.value}' after CREATE TABLE statement at ${token?.position}.`,
            );
        }

        return createTableAST;
    }
}
