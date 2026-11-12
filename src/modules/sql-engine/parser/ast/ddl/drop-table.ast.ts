import { AST, DDLType } from '../ast.class.js';
import { DDL } from './ddl.class.js';

export class DropTableAST extends DDL {
    public parse(): AST {
        throw new Error('Method not implemented.');
    }
    constructor(tableName: string) {
        super(DDLType.DROP_TABLE);
    }
}
