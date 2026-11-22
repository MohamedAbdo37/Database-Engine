import {
    DMLType,
    FromClause,
    MainClassAST,
    OrderByClause,
    SelectClause,
} from './ast.class.js';
import { WhereClauseAST } from './dml/where-clause.ast.js';

export class SelectAST extends MainClassAST {
    private _from: FromClause[];
    private _selectColumns: SelectClause[] | `*`;
    private _whereClause: WhereClauseAST;
    private _orderByClause: OrderByClause;
    private _limit: number | null;

    public get from(): FromClause[] {
        return this._from;
    }
    public set from(value: FromClause[]) {
        this._from = value;
    }
    public get selectColumns(): SelectClause[] | `*` {
        return this._selectColumns;
    }
    public set selectColumns(value: SelectClause[] | `*`) {
        this._selectColumns = value;
    }
    public get whereClause(): WhereClauseAST {
        return this._whereClause;
    }
    public set whereClause(value: WhereClauseAST) {
        this._whereClause = value;
    }
    public get orderByClause(): OrderByClause {
        return this._orderByClause;
    }
    public set orderByClause(value: OrderByClause) {
        this._orderByClause = value;
    }
    public get limit(): number | null {
        return this._limit;
    }
    public set limit(value: number | null) {
        this._limit = value;
    }

    constructor() {
        super(DMLType.SELECT);
    }
}
