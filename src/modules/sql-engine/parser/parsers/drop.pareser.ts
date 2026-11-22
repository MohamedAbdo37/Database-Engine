import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    Token,
} from '../../tokenizer/token.class.js';
import { DropTableAST } from '../ast/ddl/drop-table.ast.js';
import { Parser } from '../parser.class.js';

export class DropParser extends Parser {
    constructor(tokens: Token[]) {
        super(tokens);
    }

    public parse(): DropTableAST | null {
        const dropTableAST = new DropTableAST();

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

            if (!this.expect(new KeywordToken('EXISTS'))) {
                const token = this.peek();
                throw new SyntaxErrorException(
                    `Expected 'EXISTS' after 'IF' in DROP TABLE statement, ` +
                        (token !== null
                            ? `but found '${token?.value}' at ${token?.position}.`
                            : 'but found end of input.'),
                );
            }

            this.consume();
            dropTableAST.ifExists = true;
        } else dropTableAST.ifExists = false;

        const tableNameToken = this.consume();
        if (tableNameToken === null || tableNameToken.type !== 'IDENTIFIER') {
            throw new SyntaxErrorException(
                `Expected table name after ` +
                    (dropTableAST.ifExists
                        ? `'DROP TABLE IF EXISTS', `
                        : `'DROP TABLE', `) +
                    (tableNameToken !== null
                        ? `but found '${tableNameToken.value}' at ${tableNameToken.position}.`
                        : 'but found end of input.'),
            );
        }
        dropTableAST.tableName = tableNameToken.value;

        if (!this.expect(new PunctuationToken(';'))) {
            const token = this.peek();
            dropTableAST.missedTokenError(
                `;`,
                token?.value ?? null,
                token?.position ?? null,
                `DROP TABLE` +
                    (dropTableAST.ifExists ? ` IF EXISTS` : ``) +
                    ` ${dropTableAST.tableName}`,
            );
        }

        this.consume(); // Consume the semicolon

        if (this.peek() !== null) {
            const token = this.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${token?.value}' after DROP TABLE statement at ${token?.position}.`,
            );
        }

        return dropTableAST;
    }
}
