import { DDLType, MainClassAST } from '../ast.class.js';

export abstract class DDL extends MainClassAST {
    tableName: string;

    constructor(type: DDLType) {
        super(type);
    }
}
