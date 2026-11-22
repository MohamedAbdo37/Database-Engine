import { DDLType } from '../ast.class.js';
import { ColumnDefinition } from './column-definition.ast.js';
import { DDL } from './ddl.class.js';

export class CreateTableAST extends DDL {
    columns: ColumnDefinition[];
    ifNotExists: boolean;

    constructor() {
        super(DDLType.CREATE_TABLE);
    }

    public addColumn(column: ColumnDefinition): void {
        if (!this.columns) {
            this.columns = [];
        }
        this.columns.push(column);
    }
}
