import { Parser, ParserGenerator } from '../parser.js';

export enum DDLType {
    CREATE_TABLE = 'CREATE_TABLE',
    DROP_TABLE = 'DROP_TABLE',
    ALTER_TABLE = 'ALTER_TABLE',
}

export enum DMLType {
    INSERT = 'INSERT',
    SELECT = 'SELECT',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
}

export abstract class AST implements Parser {
    public abstract parse(parser: ParserGenerator): AST | null;
}

export abstract class MainClassAST extends AST {
    private _type: DDLType | DMLType;

    constructor(type: DDLType | DMLType) {
        super();
        this._type = type;
    }

    public get type(): string {
        return this._type;
    }
}

export abstract class SubClassAST extends AST {
    constructor() {
        super();
    }
}
