import { ParserGenerator } from '../parser.js';
import { AST, DMLType } from './ast.class.js';

export class Select extends AST {
    public parse(parser: ParserGenerator): AST | null {
        throw new Error('Method not implemented.');
    }
    constructor() {
        super();
    }
}
