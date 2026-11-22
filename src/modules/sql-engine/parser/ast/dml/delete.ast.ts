import { DMLType } from '../ast.class.js';
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
}
