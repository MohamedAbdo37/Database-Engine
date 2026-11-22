import { DMLType, MainClassAST } from '../ast.class.js';

export abstract class DML extends MainClassAST {
    tableName: string;
    constructor(type: DMLType) {
        super(type);
    }
}
