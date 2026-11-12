import { AST, DMLType } from './ast.class.js';

export class Select extends AST {
    constructor() {
        super(DMLType.SELECT);
    }
}
