import { DatatypeEnum } from '../../storage/dto/datatype.dto.js';
import {
    DatatypeToken,
    IdentifierToken,
    KeywordToken,
    LiteralToken,
    NumberToken,
    PunctuationToken,
    Token,
} from '../tokenizer/token.class.js';
import { ColumnDefinition } from './ast/ddl/column-definition.ast.js';
import { CreateTableAST } from './ast/ddl/create-table.ast.js';
import { ParserGenerator } from './parser.js';
import { Tokenizer } from '../tokenizer/tokenizer.js';

describe('ParserGenerator parse method', () => {
    it('should be defined', () => {
        expect(new ParserGenerator([])).toBeDefined();
    });

    it('should peek and consume tokens correctly', () => {
        const tokens = [new KeywordToken('CREATE'), new KeywordToken('TABLE')];
        const parserGenerator = new ParserGenerator(tokens);

        expect(parserGenerator.peek()).toEqual(tokens[0]);
        expect(parserGenerator.consume()).toEqual(tokens[0]);
        expect(parserGenerator.peek()).toEqual(tokens[1]);
        expect(parserGenerator.consume()).toEqual(tokens[1]);
        expect(parserGenerator.peek()).toBeNull();
        expect(parserGenerator.consume()).toBeNull();
    });

    it('should expect tokens correctly', () => {
        const tokens = [new KeywordToken('CREATE'), new KeywordToken('TABLE')];
        const parserGenerator = new ParserGenerator(tokens);

        expect(parserGenerator.expect(new KeywordToken('CREATE'))).toBe(true);
        parserGenerator.consume();
        expect(parserGenerator.expect(new KeywordToken('TABLE'))).toBe(true);
        parserGenerator.consume();
        expect(parserGenerator.expect(new KeywordToken('CREATE'))).toBe(false);
    });

    it('should throw an error for unexpected token', () => {
        const tokens = [new KeywordToken('Where')];
        const parserGenerator = new ParserGenerator(tokens);
        expect(() => parserGenerator.parse()).toThrow(
            "Unexpected token 'Where' at undefined.",
        );
    });
});

describe('ParserGenerator arithmetic expressions', () => {
    const computeExpression = (expression: string): number => {
        const parser = new ParserGenerator(
            new Tokenizer().tokenize(expression),
        );
        const compute = Reflect.get(parser, 'cleanTokens') as () => void;
        compute.call(parser);
        return Number(parser.peek()?.value);
    };

    it('evaluates arithmetic expressions with precedence and parentheses', () => {
        expect(computeExpression('2 + 3 * (4 + 1)')).toBe(17);
    });

    it('supports unary signs, exponentiation, and modulo', () => {
        expect(computeExpression('-2 ^ 3 % 3')).toBe(-2);
    });

    it('rejects division by zero', () => {
        const parser = new ParserGenerator(
            new Tokenizer().tokenize('10 / (3 - 3)'),
        );
        const compute = Reflect.get(parser, 'cleanTokens') as () => void;

        expect(() => compute.call(parser)).toThrow(
            'Division by zero in numeric expression.',
        );
    });
});

describe('ParserGenerator boolean expressions', () => {
    const cleanExpression = (expression: string): number => {
        const parser = new ParserGenerator(
            new Tokenizer().tokenize(expression),
        );
        const clean = Reflect.get(parser, 'cleanTokens') as () => void;
        clean.call(parser);
        return Number(parser.peek()?.value);
    };

    it('applies NOT, AND, and OR precedence correctly', () => {
        expect(cleanExpression('NOT 2 < 3 OR 4 > 1 AND 6 = 6')).toBe(1);
        expect(cleanExpression('NOT 2 < 3 AND 4 > 1')).toBe(0);
    });

    it('supports arithmetic operands in comparisons', () => {
        expect(cleanExpression('2 + 3 * 4 = 14')).toBe(1);
        expect(cleanExpression('10 % 3 = 1 AND 2 ^ 3 > 7')).toBe(1);
        expect(cleanExpression('(2 + 3) * 4 = 20')).toBe(1);
    });

    it('supports inequality operators', () => {
        expect(cleanExpression('2 <> 3')).toBe(1);
        expect(cleanExpression('2 == 2')).toBe(1);
        expect(cleanExpression('2 <= 2 AND 3 >= 2')).toBe(1);
        expect(cleanExpression('(2 < 3) AND (4 > 1)')).toBe(1);
    });
});

describe('ColumnDefinitionAST parse method', () => {
    it('should be defined', () => {
        expect(new ColumnDefinition()).toBeDefined();
    });

    it('should throw an error for missing column name', () => {
        const tokens = [new DatatypeToken('INT')];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected column name, but found 'INT' at undefined.",
        );
    });

    it('should throw an error for missing column name and found EOI', () => {
        const tokens: Token[] = [];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            'Expected column name, but found end of input.',
        );
    });

    it('should throw an error for missing datatype', () => {
        const tokens = [new IdentifierToken('id'), new PunctuationToken(',')];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected datatype for column 'id', but found ',' at undefined.",
        );
    });

    it('should throw an error for missing datatype and found EOI', () => {
        const tokens = [new IdentifierToken('id')];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected datatype for column 'id', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after datatype', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('WHERE'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Unexpected token 'WHERE' at undefined while parsing constraints for column 'id'.",
        );
    });

    it('should throw an error for primary key constraint without "key" keyword', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('UNIQUE'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected 'KEY' after 'PRIMARY' for column 'id', but found 'UNIQUE' at undefined.",
        );
    });

    it('should throw an EOI error for primary key constraint without "key" keyword ', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('PRIMARY'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected 'KEY' after 'PRIMARY' for column 'id', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after primary key constraint', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('KEY'),
            new KeywordToken('WHERE'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Unexpected token 'WHERE' at undefined while parsing constraints for column 'id'.",
        );
    });

    it('should throw an error for unexpected token after NOT constraint', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NOT'),
            new KeywordToken('WHERE'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected 'NULL' after 'NOT' for column 'id', but found 'WHERE' at undefined.",
        );
    });

    it('should throw an EOI error for unexpected token after NOT constraint', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NOT'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected 'NULL' after 'NOT' for column 'id', but found end of input.",
        );
    });

    it('should throw an error for duplicate constraints', () => {
        let tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NOT'),
            new KeywordToken('NULL'),
            new KeywordToken('NOT'),
            new KeywordToken('NULL'),
        ];

        let parserGenerator = new ParserGenerator(tokens);
        let columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Duplicate constraint 'NOT NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('KEY'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('KEY'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Duplicate constraint 'PRIMARY KEY' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('UNIQUE'),
            new KeywordToken('UNIQUE'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();
        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Duplicate constraint 'UNIQUE' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('NULL'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();
        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Duplicate constraint 'NULL' found for column 'id' at undefined.",
        );
    });

    it('should throw an error for conflicts constrains in same column', () => {
        let tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NOT'),
            new KeywordToken('NULL'),
            new KeywordToken('NULL'),
        ];

        let parserGenerator = new ParserGenerator(tokens);
        let columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Conflicting constraints 'NOT NULL' and 'NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('NOT'),
            new KeywordToken('NULL'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Conflicting constraints 'NULL' and 'NOT NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('KEY'),
            new KeywordToken('NULL'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Conflicting constraints 'PRIMARY KEY' and 'NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('KEY'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Conflicting constraints 'NULL' and 'PRIMARY KEY' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('UNIQUE'),
            new KeywordToken('NULL'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Conflicting constraints 'UNIQUE' and 'NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('UNIQUE'),
        ];

        parserGenerator = new ParserGenerator(tokens);
        columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Conflicting constraints 'NULL' and 'UNIQUE' found for column 'id' at undefined.",
        );
    });

    it('should throw an EOI error for incomplete default value ', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('DEFAULT'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected default value for column 'id', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after default value', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('DEFAULT'),
            new KeywordToken('WHERE'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        expect(() => columnDefinitionAST.parse(parserGenerator)).toThrow(
            "Expected default value for column 'id', but found WHERE at undefined.",
        );
    });

    it('should remove string delimiters but preserve escaped quotes', () => {
        const tokens = [
            new IdentifierToken('name'),
            new DatatypeToken('VARCHAR'),
            new PunctuationToken('('),
            new NumberToken('20'),
            new PunctuationToken(')'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'it\\'s'"),
        ];
        const parserGenerator = new ParserGenerator(tokens);

        const parsedColumn = new ColumnDefinition().parse(
            parserGenerator,
        ) as ColumnDefinition;

        expect(parsedColumn.defaultValue).toBe("it\\'s");
    });

    it('should remove string delimiters but preserve escaped quotes for date/time', () => {
        const tokens = [
            new IdentifierToken('created_at'),
            new DatatypeToken('TIMESTAMP'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'2023-06-01 12:00:00'"),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition().parse(
            parserGenerator,
        ) as ColumnDefinition;

        expect(parsedColumn.defaultValue).toBe('2023-06-01 12:00:00');
    });

    it('should throw an error for invalid default value for INT datatype', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'invalid'"),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Expected numeric default value for column 'id', but found 'invalid' at undefined.",
        );
    });

    it('should throw an error for invalid default value for DOUBLE datatype', () => {
        const tokens = [
            new IdentifierToken('price'),
            new DatatypeToken('DOUBLE'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'invalid'"),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Expected numeric default value for column 'price', but found 'invalid' at undefined.",
        );
    });

    it('should throw an error for invalid default value for BOOLEAN datatype', () => {
        const tokens = [
            new IdentifierToken('is_active'),
            new DatatypeToken('BOOLEAN'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'invalid'"),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Expected boolean default value ('TRUE' or 'FALSE') for column 'is_active', but found 'invalid' at undefined.",
        );
    });

    it('should throw an error for invalid default value for VARCHAR datatype', () => {
        const tokens = [
            new IdentifierToken('name'),
            new DatatypeToken('VARCHAR'),
            new PunctuationToken('('),
            new NumberToken('20'),
            new PunctuationToken(')'),
            new KeywordToken('DEFAULT'),
            new NumberToken('123'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Expected string default value for column 'name', but found '123' at undefined.",
        );
    });

    it('should throw an error for invalid default value for CHAR datatype', () => {
        const tokens = [
            new IdentifierToken('initial'),
            new DatatypeToken('CHAR'),
            new PunctuationToken('('),
            new NumberToken('1'),
            new PunctuationToken(')'),
            new KeywordToken('DEFAULT'),
            new NumberToken('123'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Expected string default value for column 'initial', but found '123' at undefined.",
        );
    });

    it('should throw an error for exceeded length of default value for VARCHAR datatype', () => {
        const tokens = [
            new IdentifierToken('name'),
            new DatatypeToken('VARCHAR'),
            new PunctuationToken('('),
            new NumberToken('5'),
            new PunctuationToken(')'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'exceeding'"),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Default value 'exceeding' exceeds the defined length of 5 for column 'name' at undefined.",
        );
    });

    it('should throw an error for exceeded length of default value for CHAR datatype', () => {
        const tokens = [
            new IdentifierToken('initial'),
            new DatatypeToken('CHAR'),
            new PunctuationToken('('),
            new NumberToken('1'),
            new PunctuationToken(')'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'AB'"),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();
        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Default value 'AB' exceeds the defined length of 1 for column 'initial' at undefined.",
        );
    });

    it('should throw an error for invalid default value for TIMESTAMP datatype', () => {
        const tokens = [
            new IdentifierToken('created_at'),
            new DatatypeToken('TIMESTAMP'),
            new KeywordToken('DEFAULT'),
            new NumberToken('123'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Expected date/time string default value for column 'created_at', but found '123' at undefined.",
        );
    });

    it('should throw an error for invalid default value for DATETIME datatype', () => {
        const tokens = [
            new IdentifierToken('created_at'),
            new DatatypeToken('DATETIME'),
            new KeywordToken('DEFAULT'),
            new NumberToken('123'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Expected date/time string default value for column 'created_at', but found '123' at undefined.",
        );
    });

    it('should throw an error for invalid default value for SERIAL datatype', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('SERIAL'),
            new KeywordToken('DEFAULT'),
            new NumberToken('123'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const parsedColumn = new ColumnDefinition();

        expect(() => parsedColumn.parse(parserGenerator)).toThrow(
            "Cannot set default value for column 'id' of type SERIAL.",
        );
    });

    it('should correctly parse a valid column definition', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NOT'),
            new KeywordToken('NULL'),
            new KeywordToken('UNIQUE'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const columnDefinitionAST = new ColumnDefinition();

        const parsedColumn = columnDefinitionAST.parse(
            parserGenerator,
        ) as ColumnDefinition;

        expect(parsedColumn.name).toBe('id');
        expect(parsedColumn.datatype).toBe(DatatypeEnum.INT);
        expect(parsedColumn.constraints).toContain('NOT_NULL');
        expect(parsedColumn.constraints).toContain('UNIQUE');
    });
});

describe('CreateTableAST parse method', () => {
    it('should throw an error for missing TABLE keyword', () => {
        const tokens = [new KeywordToken('CREATE')];
        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        expect(() => createTableAST.parse(parserGenerator)).toThrow(
            "Expected 'TABLE' after 'CREATE', but found end of input.",
        );
    });

    it('should throw an error for missing table name', () => {
        const tokens = [new KeywordToken('CREATE'), new KeywordToken('TABLE')];
        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        expect(() => createTableAST.parse(parserGenerator)).toThrow(
            "Expected table name after 'CREATE TABLE', but found end of input.",
        );
    });

    it('should throw an error for missing opening parenthesis', () => {
        const tokens = [
            new KeywordToken('CREATE'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        expect(() => createTableAST.parse(parserGenerator)).toThrow(
            "Expected '(' after table name, but found end of input.",
        );
    });

    it('should throw an error for missing column definitions', () => {
        const tokens = [
            new KeywordToken('CREATE'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken('('),
            new PunctuationToken(')'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        expect(() => createTableAST.parse(parserGenerator)).toThrow(
            "Expected at least one column definition for table 'my_table', but found ')' at undefined.",
        );
    });

    it('should throw an error for missing semicolon', () => {
        const tokens = [
            new KeywordToken('CREATE'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken('('),
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new IdentifierToken('name'),
            new DatatypeToken('VARCHAR'),
            new PunctuationToken(')'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        expect(() => createTableAST.parse(parserGenerator)).toThrow(
            "Expected ',' after column definition for table 'my_table', but found 'name' at undefined.",
        );
    });

    it('should correctly parse a valid CREATE TABLE statement', () => {
        const tokens = [
            new KeywordToken('CREATE'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken('('),
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NOT'),
            new KeywordToken('NULL'),
            new PunctuationToken(','),
            new IdentifierToken('name'),
            new DatatypeToken('VARCHAR'),
            new PunctuationToken('('),
            new NumberToken('255'),
            new PunctuationToken(')'),
            new PunctuationToken(','),
            new IdentifierToken('created_at'),
            new DatatypeToken('TIMESTAMP'),
            new PunctuationToken(')'),
            new PunctuationToken(';'),
        ];
        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        const parsedAST = createTableAST.parse(
            parserGenerator,
        ) as CreateTableAST;

        expect(parsedAST.tableName).toBe('my_table');
        expect(parsedAST.columns.length).toBe(3);
        expect(parsedAST.columns[0].name).toBe('id');
        expect(parsedAST.columns[0].datatype).toBe(DatatypeEnum.INT);
        expect(parsedAST.columns[0].constraints).toContain('NOT_NULL');
        expect(parsedAST.columns[1].name).toBe('name');
        expect(parsedAST.columns[1].datatype).toBe(DatatypeEnum.VARCHAR);
        expect(parsedAST.columns[1].length).toBe(255);
        expect(parsedAST.columns[2].name).toBe('created_at');
        expect(parsedAST.columns[2].datatype).toBe(DatatypeEnum.TIMESTAMP);
    });

    it('should throw an error for missing closing parenthesis', () => {
        const tokens = [
            new KeywordToken('CREATE'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken('('),
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new PunctuationToken(','),
            new IdentifierToken('name'),
            new DatatypeToken('VARCHAR'),
            new PunctuationToken('('),
            new NumberToken('255'),
            new PunctuationToken(')'),
            new PunctuationToken(','),
            new IdentifierToken('created_at'),
            new DatatypeToken('TIMESTAMP'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        expect(() => createTableAST.parse(parserGenerator)).toThrow(
            "Expected ')' after column definitions for table 'my_table', but found end of input.",
        );
    });

    it('should throw an error for the tokens that after the simicolon', () => {
        const tokens = [
            new KeywordToken('CREATE'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken('('),
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new PunctuationToken(','),
            new IdentifierToken('name'),
            new DatatypeToken('VARCHAR'),
            new PunctuationToken('('),
            new NumberToken('255'),
            new PunctuationToken(')'),
            new PunctuationToken(','),
            new IdentifierToken('created_at'),
            new DatatypeToken('TIMESTAMP'),
            new PunctuationToken(')'),
            new PunctuationToken(';'),
            new KeywordToken('WHERE'),
        ];

        const parserGenerator = new ParserGenerator(tokens);
        const createTableAST = new CreateTableAST();

        expect(() => createTableAST.parse(parserGenerator)).toThrow(
            "Unexpected token 'WHERE' after CREATE TABLE statement at undefined.",
        );
    });
});
