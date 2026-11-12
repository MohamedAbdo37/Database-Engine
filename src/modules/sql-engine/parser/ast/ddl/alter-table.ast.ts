import { AST, DDLType } from '../ast.class.js';
import { ColumnDefinition, DDL } from './ddl.class.js';

export enum AlterActionEnum {
    ADD_COLUMN = 'ADD_COLUMN',
    DROP_COLUMN = 'DROP_COLUMN',
    MODIFY_COLUMN = 'MODIFY_COLUMN',
}

export class AlterTableAST extends DDL {
    action: AlterActionEnum;
    column: ColumnDefinition | string;
    constructor(tableName: string) {
        super(DDLType.ALTER_TABLE);
    }

    public setAction(action: AlterActionEnum): void {
        this.action = action;
    }

    public setColumnName(column: string): void {
        this.column = column;
    }

    public setColumnDefinition(column: ColumnDefinition): void {
        this.column = column;
    }

    public parse(): AST {
        throw new Error('Method not implemented.');
    }
}
