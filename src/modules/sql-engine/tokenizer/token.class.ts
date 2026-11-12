export enum TokenType {
    MULTI_CHARACTER_OPERATOR = 'MULTI_CHARACTER_OPERATOR',
    SINGLE_CHARACTER_OPERATOR = 'SINGLE_CHARACTER_OPERATOR',
    KEYWORD = 'KEYWORD',
    DATATYPE = 'DATATYPE',
    IDENTIFIER = 'IDENTIFIER',
    NUMBER = 'NUMBER',
    LITERAL = 'LITERAL',
    PUNCTUATION = 'PUNCTUATION',
}

export abstract class Token {
    private _type: TokenType;
    private _value: string;
    private _regex: RegExp;
    private _position: string;

    public length: number;
    constructor(type: TokenType, regex: RegExp) {
        this.type = type;
        this._regex = regex;
        this.value = '';
    }

    protected test(value: string): boolean {
        return this.regex.test(value);
    }

    public equals(other: Token): boolean {
        return (
            this.type === other.type &&
            this.value.toUpperCase() === other.value.toUpperCase()
        );
    }

    public abstract isMatch(token: string): Token | null;

    public get type(): TokenType {
        return this._type;
    }
    public set type(value: TokenType) {
        this._type = value;
    }
    public get value(): string {
        return this._value;
    }

    public get regex(): RegExp {
        return this._regex;
    }
    public get position(): string {
        return this._position;
    }

    public set value(value: string) {
        this._value = value;
        this.length = value.length;
    }

    public setPosition(line: number, column: number) {
        this._position = `Line: ${line}, Column: ${column}`;
    }
}

export class MultiCharacterOperatorToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(`^([<>!]=|<>|==)`);
        super(TokenType.MULTI_CHARACTER_OPERATOR, regex);
        this.value = value;
    }

    public isMatch(token: string): Token | null {
        const pattern = new MultiCharacterOperatorToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }

        return null;
    }
}

export class SingleCharacterOperatorToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(`^([+*/%<>=\\-])`);
        super(TokenType.SINGLE_CHARACTER_OPERATOR, regex);
        this.value = value;
    }

    public isMatch(token: string): Token | null {
        const pattern = new SingleCharacterOperatorToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }
        return null;
    }
}

export class KeywordToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(
            `^(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|ALTER|CREATE|TABLE|ORDER|GROUP|BY|AS|LIMIT|OFFSET|PRIMARY|KEY|NOT|NULL|CHECK|TRUE|FALSE|IF|NOT|EXISTS)\\b`,
            'i',
        );
        super(TokenType.KEYWORD, regex);
        this.value = value;
    }
    public isMatch(token: string): Token | null {
        const pattern = new KeywordToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }
        return null;
    }
}

export class DatatypeToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(
            `^(INTEGER|INT|VARCHAR|CHAR|DATE|DOUBLE|TIMESTAMP|DATETIME)\\b`,
            'i',
        );
        super(TokenType.DATATYPE, regex);

        this.value = value;
    }

    public isMatch(token: string): Token | null {
        const pattern = new DatatypeToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }
        return null;
    }
}

export class IdentifierToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(`^([a-zA-Z_][a-zA-Z0-9_]*)`);
        super(TokenType.IDENTIFIER, regex);
        this.value = value;
    }

    public isMatch(token: string): Token | null {
        const pattern = new IdentifierToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }
        return null;
    }
}

export class NumberToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(
            `^[0-9]+(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?(?![a-zA-Z_])`,
        );
        super(TokenType.NUMBER, regex);

        this.value = value;
    }
    public isMatch(token: string): Token | null {
        const pattern = new NumberToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }
        return null;
    }
}

export class LiteralToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(`^('([^']*)'|"([^"]*)")`);
        super(TokenType.LITERAL, regex);

        this.value = value;
    }

    public isMatch(token: string): Token | null {
        const pattern = new LiteralToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }
        return null;
    }
}

export class PunctuationToken extends Token {
    constructor(value: string = '') {
        const regex = new RegExp(`^([(),;])`);
        super(TokenType.PUNCTUATION, regex);

        this.value = value;
    }

    public isMatch(token: string): Token | null {
        const pattern = new PunctuationToken();
        if (pattern.test(token)) {
            pattern.value = token.match(pattern.regex)![0];
            return pattern;
        }
        return null;
    }
}
