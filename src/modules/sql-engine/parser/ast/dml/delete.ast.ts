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

export class DeleteAST extends DML {
    private _whereCondition: WhereClauseAST | null;

    public get whereCondition(): WhereClauseAST | null {
        return this._whereCondition;
    }
    public set whereCondition(value: WhereClauseAST | null) {
        this._whereCondition = value;
    }

    constructor() {
        super(DMLType.DELETE);
    }

    private parseCondition(): void {
        this._whereCondition = new WhereClauseAST().parse(
            this.parser,
        ) as WhereClauseAST;
    }

    public parse(parser: ParserGenerator): AST | null {
        this.parser = parser;
        this.consume(); // Consume the DELETE token

        if (!this.expect(new KeywordToken('FROM'))) {
            const foundToken = this.peek();
            this.missedTokenError(
                'FROM',
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                'DELETE',
            );
        }
        this.consume();

        const tableNameToken = this.peek();
        if (!tableNameToken || tableNameToken.type !== 'IDENTIFIER') {
            this.missedTokenError(
                'table name',
                tableNameToken ? tableNameToken.value : null,
                tableNameToken ? tableNameToken.position : null,
                'DELETE FROM',
            );
        }

        this.consume();

        this.tableName = tableNameToken.value;
        let whereIsExist = false;
        if (this.expect(new KeywordToken('WHERE'))) {
            this.consume();
            this.parseCondition();
            whereIsExist = true;
        }

        if (!this.expect(new PunctuationToken(';'))) {
            const foundToken = this.peek();
            this.missedTokenError(
                whereIsExist ? ';' : "WHERE' or ';",
                foundToken ? foundToken.value : null,
                foundToken ? foundToken.position : null,
                whereIsExist
                    ? `DELETE FROM ${this.tableName} WHERE ${this.whereCondition?.leftOperand} ${this.whereCondition?.operator} ${this.whereCondition?.rightOperand}`
                    : 'DELETE FROM ' + this.tableName,
            );
        }

        this.consume(); // Consume the semicolon token

        if (this.peek() !== null) {
            const foundToken = this.peek();
            throw new SyntaxErrorException(
                `Unexpected token '${foundToken!.value}' after DELETE Statement at ${foundToken!.position}.`,
            );
        }
        return this;
    }
}
