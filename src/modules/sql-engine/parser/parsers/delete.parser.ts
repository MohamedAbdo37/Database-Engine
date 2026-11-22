import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    Token,
} from '../../tokenizer/token.class.js';
import { AST } from '../ast/ast.class.js';
import { DeleteAST } from '../ast/dml/delete.ast.js';
import { WhereClauseAST } from '../ast/dml/where-clause.ast.js';
import { Parser } from '../parser.class.js';
import { WhereParser } from './where.parser.js';

export class DeleteParser extends Parser {
    private deleteAST: DeleteAST;
    constructor(tokens: Token[]) {
        super(tokens);
        this.deleteAST = new DeleteAST();
    }

    private parseCondition(): WhereClauseAST {
        const whereParser = new WhereParser(this.tokens);
        const remainingBefore = whereParser.tokens.length;
        const whereCondition = whereParser.parse() as WhereClauseAST;
        const consumed = remainingBefore - whereParser.tokens.length;

        this.consume(0, consumed);

        return whereCondition;
    }

    public parse(): DeleteAST | null {
        this.consume(); // Consume the DELETE token

        if (!this.expect(new KeywordToken('FROM'))) {
            const foundToken = this.peek();
            this.deleteAST.missedTokenError(
                'FROM',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                'DELETE',
            );
        }
        this.consume();

        const tableNameToken = this.peek();
        if (!tableNameToken || tableNameToken.type !== 'IDENTIFIER') {
            this.deleteAST.missedTokenError(
                'table name',
                tableNameToken ? tableNameToken.value : null,
                tableNameToken ? tableNameToken.position : null,
                'DELETE FROM',
            );
        }

        this.consume();

        this.deleteAST.tableName = tableNameToken.value;
        let whereIsExist = false;
        if (this.expect(new KeywordToken('WHERE'))) {
            this.consume();
            this.deleteAST.whereCondition = this.parseCondition();
            whereIsExist = true;
        }

        if (!this.expect(new PunctuationToken(';'))) {
            const foundToken = this.peek();
            this.deleteAST.missedTokenError(
                whereIsExist ? ';' : "WHERE' or ';",
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                whereIsExist
                    ? `DELETE FROM ${this.deleteAST.tableName} WHERE ${this.deleteAST.whereCondition?.leftOperand} ${this.deleteAST.whereCondition?.operator} ${this.deleteAST.whereCondition?.rightOperand}`
                    : 'DELETE FROM ' + this.deleteAST.tableName,
            );
        }

        this.consume(); // Consume the semicolon token

        if (this.peek() !== null) {
            const foundToken = this.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${foundToken!.value}' after DELETE Statement at ${foundToken!.position}.`,
            );
        }

        return this.deleteAST;
    }
}
