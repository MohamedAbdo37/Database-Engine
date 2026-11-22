import { WhereOperator } from '../../../../storage/table-manager/table-manager.js';
import { SyntaxErrorException } from '../../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    TokenType,
} from '../../../tokenizer/token.class.js';
import { ParserGenerator } from '../../parsers/parser-generator.parser.js';
import { DMLType } from '../ast.class.js';
import { DML } from './dml.class.js';
import { WhereClauseAST } from './where-clause.ast.js';

export interface UpdateColumnAssignment {
    column: string;
    value: any;
    isNull: boolean;
}

export class UpdateAST extends DML {
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
}
