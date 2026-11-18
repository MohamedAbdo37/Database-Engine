import { SyntaxErrorException } from '../../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
} from '../../../tokenizer/token.class.js';
import { ParserGenerator } from '../../parser.js';
import { AST, DDLType } from '../ast.class.js';
import { DDL } from './ddl.class.js';

export class DropTableAST extends DDL {
    ifExists: boolean;
    constructor() {
        super(DDLType.DROP_TABLE);
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

        if (parser.expect(new KeywordToken('IF'))) {
            parser.consume();

            if (!parser.expect(new KeywordToken('EXISTS'))) {
                const token = parser.peek();
                throw new SyntaxErrorException(
                    `Expected 'EXISTS' after 'IF' in DROP TABLE statement, ` +
                        (token !== null
                            ? `but found '${token?.value}' at ${token?.position}.`
                            : 'but found end of input.'),
                );
            }

            parser.consume();
            this.ifExists = true;
        } else this.ifExists = false;

        const tableNameToken = parser.consume();
        if (tableNameToken === null || tableNameToken.type !== 'IDENTIFIER') {
            throw new SyntaxErrorException(
                `Expected table name after ` +
                    (this.ifExists
                        ? `'DROP TABLE IF EXISTS', `
                        : `'DROP TABLE', `) +
                    (tableNameToken !== null
                        ? `but found '${tableNameToken.value}' at ${tableNameToken.position}.`
                        : 'but found end of input.'),
            );
        }
        this.tableName = tableNameToken.value;

        if (!parser.expect(new PunctuationToken(';'))) {
            const token = parser.peek();
            this.missedTokenError(
                `;`,
                token?.value ?? null,
                token?.position ?? null,
                `DROP TABLE` +
                    (this.ifExists ? ` IF EXISTS` : ``) +
                    ` ${this.tableName}`,
            );
        }

        parser.consume(); // Consume the semicolon

        if (parser.peek() !== null) {
            const token = parser.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${token?.value}' after DROP TABLE statement at ${token?.position}.`,
            );
        }

        return this;
    }
}
