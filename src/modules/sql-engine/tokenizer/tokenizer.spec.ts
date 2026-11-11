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
});
