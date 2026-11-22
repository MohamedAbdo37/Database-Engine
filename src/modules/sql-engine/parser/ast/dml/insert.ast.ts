import { DMLType } from '../ast.class.js';
import { DML } from './dml.class.js';

export interface InsertColumn {
    name: string;
    value: any;
    isNullable: boolean;
}

export interface InsertRow {
    columns: InsertColumn[];
}

export class InsertAST extends DML {
    columns: string[] = [];
    rows: InsertRow[] = [];

    constructor() {
        super(DMLType.INSERT);
    }
}
