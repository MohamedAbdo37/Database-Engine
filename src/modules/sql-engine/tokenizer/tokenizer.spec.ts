import { Tokenizer } from './tokenizer.js';

describe('Tokenizer', () => {
    it('should be defined', () => {
        expect(new Tokenizer()).toBeDefined();
    });

    it('should tokenize a simple DDL SQL query', () => {
        const tokenizer = new Tokenizer();
        const sqlQuery = 'CREATE TABLE users (id INT, name VARCHAR(100))';
        const tokens = tokenizer.tokenize(sqlQuery);

        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens[0].value).toBe('CREATE');
        expect(tokens[0].type).toBe('KEYWORD');

        expect(tokens[1].value).toBe('TABLE');
        expect(tokens[1].type).toBe('KEYWORD');

        expect(tokens[2].value).toBe('users');
        expect(tokens[2].type).toBe('IDENTIFIER');

        expect(tokens[3].value).toBe('(');
        expect(tokens[3].type).toBe('PUNCTUATION');

        expect(tokens[4].value).toBe('id');
        expect(tokens[4].type).toBe('IDENTIFIER');

        expect(tokens[5].value).toBe('INT');
        expect(tokens[5].type).toBe('DATATYPE');

        expect(tokens[6].value).toBe(',');
        expect(tokens[6].type).toBe('PUNCTUATION');

        expect(tokens[7].value).toBe('name');
        expect(tokens[7].type).toBe('IDENTIFIER');

        expect(tokens[8].value).toBe('VARCHAR');
        expect(tokens[8].type).toBe('DATATYPE');

        expect(tokens[9].value).toBe('(');
        expect(tokens[9].type).toBe('PUNCTUATION');

        expect(tokens[10].value).toBe('100');
        expect(tokens[10].type).toBe('NUMBER');

        expect(tokens[11].value).toBe(')');
        expect(tokens[11].type).toBe('PUNCTUATION');

        expect(tokens[12].value).toBe(')');
        expect(tokens[12].type).toBe('PUNCTUATION');
    });

    it('should tokenize a complex DDL SQL query with multiple operators and keywords', () => {
        const tokenizer = new Tokenizer();
        const sqlQuery =
            '\t\t   \nCREATE    TABLE users (\n\tid INT PRIMARY KEY, \t\nname VARCHAR(100) NOT NULL,\n\t age INT CHECK (age >= 18)\n);';
        const tokens = tokenizer.tokenize(sqlQuery);

        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens[0].value).toBe('CREATE');
        expect(tokens[0].type).toBe('KEYWORD');

        expect(tokens[1].value).toBe('TABLE');
        expect(tokens[1].type).toBe('KEYWORD');

        expect(tokens[2].value).toBe('users');
        expect(tokens[2].type).toBe('IDENTIFIER');

        expect(tokens[3].value).toBe('(');
        expect(tokens[3].type).toBe('PUNCTUATION');

        expect(tokens[4].value).toBe('id');
        expect(tokens[4].type).toBe('IDENTIFIER');

        expect(tokens[5].value).toBe('INT');
        expect(tokens[5].type).toBe('DATATYPE');

        expect(tokens[6].value).toBe('PRIMARY');
        expect(tokens[6].type).toBe('KEYWORD');

        expect(tokens[7].value).toBe('KEY');
        expect(tokens[7].type).toBe('KEYWORD');

        expect(tokens[8].value).toBe(',');
        expect(tokens[8].type).toBe('PUNCTUATION');

        expect(tokens[9].value).toBe('name');
        expect(tokens[9].type).toBe('IDENTIFIER');

        expect(tokens[10].value).toBe('VARCHAR');
        expect(tokens[10].type).toBe('DATATYPE');

        expect(tokens[11].value).toBe('(');
        expect(tokens[11].type).toBe('PUNCTUATION');

        expect(tokens[12].value).toBe('100');
        expect(tokens[12].type).toBe('NUMBER');

        expect(tokens[13].value).toBe(')');
        expect(tokens[13].type).toBe('PUNCTUATION');

        expect(tokens[14].value).toBe('NOT');
        expect(tokens[14].type).toBe('KEYWORD');

        expect(tokens[15].value).toBe('NULL');
        expect(tokens[15].type).toBe('KEYWORD');

        expect(tokens[16].value).toBe(',');
        expect(tokens[16].type).toBe('PUNCTUATION');

        expect(tokens[17].value).toBe('age');
        expect(tokens[17].type).toBe('IDENTIFIER');

        expect(tokens[18].value).toBe('INT');
        expect(tokens[18].type).toBe('DATATYPE');

        expect(tokens[19].value).toBe('CHECK');
        expect(tokens[19].type).toBe('KEYWORD');

        expect(tokens[20].value).toBe('(');
        expect(tokens[20].type).toBe('PUNCTUATION');

        expect(tokens[21].value).toBe('age');
        expect(tokens[21].type).toBe('IDENTIFIER');

        expect(tokens[22].value).toBe('>=');
        expect(tokens[22].type).toBe('MULTI_CHARACTER_OPERATOR');

        expect(tokens[23].value).toBe('18');
        expect(tokens[23].type).toBe('NUMBER');

        expect(tokens[24].value).toBe(')');
        expect(tokens[24].type).toBe('PUNCTUATION');

        expect(tokens[25].value).toBe(')');
        expect(tokens[25].type).toBe('PUNCTUATION');

        expect(tokens[26].value).toBe(';');
        expect(tokens[26].type).toBe('PUNCTUATION');
    });

    it('should throw an UnexpectedTokenException for an invalid DDL SQL query', () => {
        const tokenizer = new Tokenizer();
        const sqlQuery = `CREATE Table users(
          id @INT,
          name VARCHAR(100),
          age INT
        );`;

        expect(() => tokenizer.tokenize(sqlQuery)).toThrow(
            'Unexpected token @ at position 2:4',
        );
    });

    it('should tokenize a simple DML SQL query', () => {
        const tokenizer = new Tokenizer();
        const sqlQuery = 'SELECT * FROM users WHERE age > 30';
        const tokens = tokenizer.tokenize(sqlQuery);

        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens[0].type).toBe('KEYWORD');
        expect(tokens[1].type).toBe('SINGLE_CHARACTER_OPERATOR');
        expect(tokens[2].type).toBe('KEYWORD');
        expect(tokens[3].type).toBe('IDENTIFIER');
        expect(tokens[4].type).toBe('KEYWORD');
        expect(tokens[5].type).toBe('IDENTIFIER');
        expect(tokens[6].type).toBe('SINGLE_CHARACTER_OPERATOR');
        expect(tokens[7].type).toBe('NUMBER');

        expect(tokens[0].value).toBe('SELECT');
        expect(tokens[1].value).toBe('*');
        expect(tokens[2].value).toBe('FROM');
        expect(tokens[3].value).toBe('users');
        expect(tokens[4].value).toBe('WHERE');
        expect(tokens[5].value).toBe('age');
        expect(tokens[6].value).toBe('>');
        expect(tokens[7].value).toBe('30');
    });

    it('should tokenize a complex DML SQL query with multiple operators and keywords', () => {
        const tokenizer = new Tokenizer();
        const sqlQuery =
            '\t\t\n\tSELECT id, name\n\t FROM users\n WHERE age >= 18\t AND\t\n name != "John Doe" \tOR\t\n id < 100\t;';
        const tokens = tokenizer.tokenize(sqlQuery);

        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens[0].value).toBe('SELECT');
        expect(tokens[0].type).toBe('KEYWORD');

        expect(tokens[1].value).toBe('id');
        expect(tokens[1].type).toBe('IDENTIFIER');

        expect(tokens[2].value).toBe(',');
        expect(tokens[2].type).toBe('PUNCTUATION');

        expect(tokens[3].value).toBe('name');
        expect(tokens[3].type).toBe('IDENTIFIER');

        expect(tokens[4].value).toBe('FROM');
        expect(tokens[4].type).toBe('KEYWORD');

        expect(tokens[5].value).toBe('users');
        expect(tokens[5].type).toBe('IDENTIFIER');

        expect(tokens[6].value).toBe('WHERE');
        expect(tokens[6].type).toBe('KEYWORD');

        expect(tokens[7].value).toBe('age');
        expect(tokens[7].type).toBe('IDENTIFIER');

        expect(tokens[8].value).toBe('>=');
        expect(tokens[8].type).toBe('MULTI_CHARACTER_OPERATOR');

        expect(tokens[9].value).toBe('18');
        expect(tokens[9].type).toBe('NUMBER');

        expect(tokens[10].value).toBe('AND');
        expect(tokens[10].type).toBe('KEYWORD');

        expect(tokens[11].value).toBe('name');
        expect(tokens[11].type).toBe('IDENTIFIER');

        expect(tokens[12].value).toBe('!=');
        expect(tokens[12].type).toBe('MULTI_CHARACTER_OPERATOR');

        expect(tokens[13].value).toBe('"John Doe"');
        expect(tokens[13].type).toBe('LITERAL');

        expect(tokens[14].value).toBe('OR');
        expect(tokens[14].type).toBe('KEYWORD');

        expect(tokens[15].value).toBe('id');
        expect(tokens[15].type).toBe('IDENTIFIER');

        expect(tokens[16].value).toBe('<');
        expect(tokens[16].type).toBe('SINGLE_CHARACTER_OPERATOR');

        expect(tokens[17].value).toBe('100');
        expect(tokens[17].type).toBe('NUMBER');

        expect(tokens[18].value).toBe(';');
        expect(tokens[18].type).toBe('PUNCTUATION');
    });

    it('should throw an UnexpectedTokenException for an invalid DML SQL query', () => {
        const tokenizer = new Tokenizer();
        const sqlQuery =
            'SELECT * FROM users WHERE age > 30 AND @invalid_token';

        expect(() => tokenizer.tokenize(sqlQuery)).toThrow(
            'Unexpected token @ at position 1:40',
        );
    });

    it('should have NumberToken only for integer values', () => {
        const tokenizer = new Tokenizer();
        const text = '30';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('NUMBER');
        expect(tokens[0].value).toBe('30');
    });

    it('should have NumberToken only for decimal values', () => {
        const tokenizer = new Tokenizer();
        const text = '30.5';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('NUMBER');
        expect(tokens[0].value).toBe('30.5');
    });

    it('should have NumberToken only for decimal values with e', () => {
        const tokenizer = new Tokenizer();
        const text = '1.23e4';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('NUMBER');
        expect(tokens[0].value).toBe('1.23e4');
    });

    it('should have LiteralToken only for string literals with double quotations', () => {
        const tokenizer = new Tokenizer();
        const text = '"John Doe"';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('LITERAL');
        expect(tokens[0].value).toBe('"John Doe"');
    });

    it('should have LiteralToken only for string literals with single quotation', () => {
        const tokenizer = new Tokenizer();
        const text = "'John Doe'";
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('LITERAL');
        expect(tokens[0].value).toBe("'John Doe'");
    });

    it('should have no matching token for an invalid string literal open and not closed', () => {
        const tokenizer = new Tokenizer();
        const text = '"John Doe';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have IdentifierToken for an invalid string literal closed and not opened', () => {
        const tokenizer = new Tokenizer();
        const text = 'John Doe"';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe('John');
    });

    it('should have no matching token for an invalid string literal with single quotation open and not closed', () => {
        const tokenizer = new Tokenizer();
        const text = "'John Doe";
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have IdentifierToken for an invalid string literal with single quotation closed and not opened', () => {
        const tokenizer = new Tokenizer();
        const text = "John Doe'";
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe('John');
    });

    it('should have no matching token for an invalid string literal with single quotation closed and double quotation opened', () => {
        const tokenizer = new Tokenizer();
        const text = '\'John Doe"';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have no matching token for an invalid string literal with double quotation closed and single quotation opened', () => {
        const tokenizer = new Tokenizer();
        const text = '"John Doe\'';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have 2 matching tokens for a keyword and an identifier', () => {
        const tokenizer = new Tokenizer();
        const text = 'CREATE TABLE';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(2);
        expect(tokens[0].type).toBe('KEYWORD');
        expect(tokens[0].value).toBe('CREATE');
        expect(tokens[1].type).toBe('IDENTIFIER');
        expect(tokens[1].value).toBe('CREATE');
    });

    it('should have IdentifierToken for a valid identifier with underscore', () => {
        const tokenizer = new Tokenizer();
        const text = 'my_table';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe('my_table');
    });

    it('should have IdentifierToken for a valid identifier ends numbers', () => {
        const tokenizer = new Tokenizer();
        const text = 'table1';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe('table1');
    });

    it('should have IdentifierToken for a valid identifier with numbers in th middle', () => {
        const tokenizer = new Tokenizer();
        const text = 'my1table';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe('my1table');
    });

    it('should have IdentifierToken for a valid identifier with numbers in the middle and underscore', () => {
        const tokenizer = new Tokenizer();
        const text = 'my1_table';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe('my1_table');
    });

    it('it should have no matching token for white space', () => {
        const tokenizer = new Tokenizer();
        const text = '   ';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have no matching token for single quotation', () => {
        const tokenizer = new Tokenizer();
        const text = "'";
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have no matching token for double quotation', () => {
        const tokenizer = new Tokenizer();
        const text = '"';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have no matching token for an empty string', () => {
        const tokenizer = new Tokenizer();
        const text = '';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have no matching token for a dot', () => {
        const tokenizer = new Tokenizer();
        const text = '.';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have identifier token for a valid identifier', () => {
        const tokenizer = new Tokenizer();
        const text = 'my_table';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('IDENTIFIER');
        expect(tokens[0].value).toBe('my_table');
    });

    it('should have no matching token for an invalid identifier starting with a special character', () => {
        const tokenizer = new Tokenizer();
        const text = '!my_table';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have no for an invalid identifier starting with a number', () => {
        const tokenizer = new Tokenizer();
        const text = '1my_table';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should match numbers written in scientific notation', () => {
        const tokenizer = new Tokenizer();
        const tokens = tokenizer['isMatchingToken']('1.12e3');

        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe('NUMBER');
        expect(tokens[0].value).toBe('1.12e3');
    });

    it('should have PunctuationToken for a valid punctuation', () => {
        const tokenizer = new Tokenizer();
        const text = ',';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('PUNCTUATION');
        expect(tokens[0].value).toBe(',');
    });

    it('should have no matching token for an invalid punctuation', () => {
        const tokenizer = new Tokenizer();
        const text = '@';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(0);
    });

    it('should have 2 matched for a valid double character operator', () => {
        const tokenizer = new Tokenizer();
        const text = '>=';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(2);
        expect(tokens[0].type).toBe('MULTI_CHARACTER_OPERATOR');
        expect(tokens[0].value).toBe('>=');
        expect(tokens[1].type).toBe('SINGLE_CHARACTER_OPERATOR');
        expect(tokens[1].value).toBe('>');
    });

    it('should have SingleCharacterOperatorToken for a valid single character operator', () => {
        const tokenizer = new Tokenizer();
        const text = '>';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe('SINGLE_CHARACTER_OPERATOR');
        expect(tokens[0].value).toBe('>');
    });

    it('should have 2 matched tokens for a valid datatype token', () => {
        const tokenizer = new Tokenizer();
        const text = 'INT';
        const tokens = tokenizer['isMatchingToken'](text);

        expect(tokens.length).toBe(2);
        expect(tokens[0].type).toBe('DATATYPE');
        expect(tokens[0].value).toBe('INT');
        expect(tokens[1].type).toBe('IDENTIFIER');
        expect(tokens[1].value).toBe('INT');
    });
});
