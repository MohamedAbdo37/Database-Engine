import { DDLType } from '../ast.class.js';
import { DDL } from './ddl.class.js';

export class DropTableAST extends DDL {
    ifExists: boolean;
    constructor() {
        super(DDLType.DROP_TABLE);
    }
}
