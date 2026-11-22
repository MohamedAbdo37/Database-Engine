import { Catalog } from '../../../storage/dto/catalog.dto.js';
import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import { Token } from '../../tokenizer/token.class.js';
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

    protected missedTokenError(
        expectedToken: string,
        foundToken: string | null,
        foundTokenPosition: string | null,
        afterToken?: string | null,
    ): never {
        throw new SyntaxErrorException(
            `Expected '${expectedToken}' ` +
                (afterToken ? `after '${afterToken}'` : '') +
                `, ` +
                (foundToken !== null
                    ? `but found '${foundToken}' at ${foundTokenPosition}.`
                    : 'but found end of input.'),
        );
    }
}

export abstract class MainClassAST extends AST {
    private _type: DDLType | DMLType;
    protected parser: ParserGenerator;

    constructor(type: DDLType | DMLType) {
        super();
        this._type = type;
    }

    public get type(): string {
        return this._type;
    }

    protected peek(): Token | null {
        return this.parser.peek();
    }

    protected next(): Token | null {
        return this.parser.next();
    }

    protected consume(): Token | null {
        return this.parser.consume();
    }

    protected expect(expectedToken: Token): boolean {
        return this.parser.expect(expectedToken);
    }
}

export abstract class SubClassAST extends AST {
    constructor() {
        super();
    }
}

export enum OrderDirection {
    ASC = 'ASC',
    DESC = 'DESC',
}

export interface FromClause {
    tableName: string;
    alias?: string;
    schema?: Catalog;
}

export interface SelectClause {
    name: string;
    as?: string;
    from?: string;
    tableName?: string;
}

export interface OrderByClause {
    column: SelectClause;
    direction: OrderDirection;
}
