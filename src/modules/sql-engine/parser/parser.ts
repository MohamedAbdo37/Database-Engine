import { Injectable } from '@nestjs/common';
import {
    DATETIME,
    DOUBLE,
    INT,
    SERIAL,
    TIMESTAMP,
} from '../../storage/dto/datatype.dto.js';
import { SyntaxErrorException } from '../exceptions/syntax-error.exc.js';
import { KeywordToken, Token } from '../tokenizer/token.class.js';
import { AST } from './ast/ast.class.js';
import { CreateTableAST } from './ast/ddl/create-table.ast.js';

export interface Parser {
    parse(parserGenerator: ParserGenerator): AST | null;
}

@Injectable()
export class ParserGenerator {
    private tokens: Token[] = [];

    constructor(tokens: Token[]) {
        this.tokens = [...tokens];
    }

    public peek(): Token | null {
        if (this.tokens.length > 0) {
            return this.tokens[0];
        }
        return null;
    }

    public consume(): Token | null {
        if (this.tokens.length > 0) {
            return this.tokens.shift() || null;
        }

        return null;
    }

    public expect(expectedToken: Token): boolean {
        const token = this.peek();
        return token !== null && token.equals(expectedToken);
    }

    public parse(): AST | null {
        let token = this.peek();
        if (token === null) {
            throw new SyntaxErrorException(
                `Unexpected end of input while parsing SQL query.`,
            );
        }

        switch (true) {
            case new KeywordToken('CREATE').equals(token):
                return new CreateTableAST().parse(this);
            default:
                throw new SyntaxErrorException(
                    `Unexpected token '${token.value}' at ${token.position}.`,
                );
        }
    }
}
