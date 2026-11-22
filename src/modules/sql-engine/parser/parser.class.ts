import { Token } from '../tokenizer/token.class.js';
import { AST } from './ast/ast.class.js';

export abstract class Parser {
    private _tokens: Token[] = [];

    public get tokens(): Token[] {
        return this._tokens;
    }

    constructor(tokens: Token[]) {
        this._tokens = [...tokens];
    }

    abstract parse(): AST | null;

    public peek(id?: number): Token | null {
        if (id !== undefined && id >= 0 && id < this.tokens.length) {
            return this.tokens[id];
        } else if (this.tokens.length > 0) {
            return this.tokens[0];
        }
        return null;
    }

    public next(id?: number): Token | null {
        if (id !== undefined && id >= 0 && id < this.tokens.length) {
            return this.tokens[id + 1] || null;
        } else if (this.tokens.length > 1) {
            return this.tokens[1] || null;
        }
        return null;
    }

    public consume(id?: number, length: number = 1): Token | null {
        if (id !== undefined && id >= 0 && id < this.tokens.length) {
            return this.tokens.splice(id, length)[0] || null;
        } else if (this.tokens.length > 0) {
            return this.tokens.shift() || null;
        }
        return null;
    }

    public expect(expectedToken: Token, id?: number): boolean {
        if (id !== undefined && id >= 0 && id < this.tokens.length) {
            const token = this.tokens[id];
            return token !== null && token.equals(expectedToken);
        }
        const token = this.peek();
        return token !== null && token.equals(expectedToken);
    }
}
