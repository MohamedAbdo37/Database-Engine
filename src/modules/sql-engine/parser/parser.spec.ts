import { DatatypeEnum } from '../../storage/dto/datatype.dto.js';
import {
    DatatypeToken,
    IdentifierToken,
    KeywordToken,
    LiteralToken,
    NumberToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
} from '../tokenizer/token.class.js';
import { ColumnDefinition } from './ast/ddl/column-definition.ast.js';
import { CreateTableAST } from './ast/ddl/create-table.ast.js';
import { UpdateAST } from './ast/dml/update.ast.js';
import { ParserGenerator } from './parsers/parser-generator.parser.js';
import { Tokenizer } from '../tokenizer/tokenizer.js';
import { DeleteAST } from './ast/dml/delete.ast.js';
import { DropTableAST } from './ast/ddl/drop-table.ast.js';
import { SelectAST } from './ast/select.class.js';
import { OrderDirection } from './ast/ast.class.js';
import { ColumnDefinitionParser } from './parsers/column-definition.parser.js';
import { CreateParser } from './parsers/create.parser.js';
import { DropParser } from './parsers/drop.pareser.js';
import { InsertAST } from './ast/dml/insert.ast.js';
import { UpdateParser } from './parsers/update.parser.js';
import { DeleteParser } from './parsers/delete.parser.js';
import { SelectParser } from './parsers/select.parser.js';

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
        const clean = parser['cleanTokens'] as () => void;
        clean.call(parser);
        return Number(parser.peek()?.value);
    };

    const cleanExpressionWithIdentifiers = (expression: string): any => {
        const parser = new ParserGenerator(
            new Tokenizer().tokenize(expression),
        );
        const clean = parser['cleanTokens'] as () => void;
        clean.call(parser);
        return parser['tokens'];
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

    it;

    it('supports identifiers and literals in boolean expressions', () => {
        const expectedTokens = [
            new PunctuationToken('('),
            new NumberToken('12'),
            new SingleCharacterOperatorToken('<'),
            new IdentifierToken('id'),
            new KeywordToken('AND'),
            new IdentifierToken('age'),
            new SingleCharacterOperatorToken('<'),
            new LiteralToken('"exAge"'),
            new PunctuationToken(')'),
            new KeywordToken('OR'),
            new KeywordToken('FALSE'),
        ];
        const tokens = cleanExpressionWithIdentifiers(
            `(12 < id AND age < "exAge") OR 5 < 4`,
        );
        expect(tokens).toHaveLength(expectedTokens.length);
        expectedTokens.forEach((expectedToken, index) => {
            const actualToken = tokens[index];
            expect(actualToken.constructor.name).toBe(
                expectedToken.constructor.name,
            );
            expect(actualToken.value).toBe(expectedToken.value);
        });
    });
});

describe('ColumnDefinitionAST parse method', () => {
    it('should be defined', () => {
        expect(new ColumnDefinition()).toBeDefined();
    });

    it('should throw an error for missing column name', () => {
        const tokens = [new DatatypeToken('INT')];
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Expected column name, but found 'INT' at undefined.",
        );
    });

    it('should throw an error for missing column name and found EOI', () => {
        const tokens: Token[] = [];
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            'Expected column name, but found end of input.',
        );
    });

    it('should throw an error for missing datatype', () => {
        const tokens = [new IdentifierToken('id'), new PunctuationToken(',')];
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Expected datatype for column 'id', but found ',' at undefined.",
        );
    });

    it('should throw an error for missing datatype and found EOI', () => {
        const tokens = [new IdentifierToken('id')];
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Expected datatype for column 'id', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after datatype', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('WHERE'),
        ];
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Expected 'KEY' after 'PRIMARY' for column 'id', but found 'UNIQUE' at undefined.",
        );
    });

    it('should throw an EOI error for primary key constraint without "key" keyword ', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('PRIMARY'),
        ];
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Expected 'NULL' after 'NOT' for column 'id', but found 'WHERE' at undefined.",
        );
    });

    it('should throw an EOI error for unexpected token after NOT constraint', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NOT'),
        ];
        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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

        let columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Duplicate constraint 'PRIMARY KEY' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('UNIQUE'),
            new KeywordToken('UNIQUE'),
        ];

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Duplicate constraint 'UNIQUE' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('NULL'),
        ];

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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

        let columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Conflicting constraints 'NOT NULL' and 'NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('NOT'),
            new KeywordToken('NULL'),
        ];

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Conflicting constraints 'NULL' and 'NOT NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('KEY'),
            new KeywordToken('NULL'),
        ];

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Conflicting constraints 'PRIMARY KEY' and 'NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('PRIMARY'),
            new KeywordToken('KEY'),
        ];

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Conflicting constraints 'NULL' and 'PRIMARY KEY' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('UNIQUE'),
            new KeywordToken('NULL'),
        ];

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Conflicting constraints 'UNIQUE' and 'NULL' found for column 'id' at undefined.",
        );

        tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('NULL'),
            new KeywordToken('UNIQUE'),
        ];

        columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
            "Conflicting constraints 'NULL' and 'UNIQUE' found for column 'id' at undefined.",
        );
    });

    it('should throw an EOI error for incomplete default value ', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('DEFAULT'),
        ];

        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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

        const columnDefinitionParser = new ColumnDefinitionParser(tokens);

        expect(() => columnDefinitionParser.parse()).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(
            tokens,
        ).parse() as ColumnDefinition;

        expect(parsedColumn.defaultValue).toBe("it\\'s");
    });

    it('should remove string delimiters but preserve escaped quotes for date/time', () => {
        const tokens = [
            new IdentifierToken('created_at'),
            new DatatypeToken('TIMESTAMP'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'2023-06-01 12:00:00'"),
        ];

        const parsedColumn = new ColumnDefinitionParser(
            tokens,
        ).parse() as ColumnDefinition;

        expect(parsedColumn.defaultValue).toBe('2023-06-01 12:00:00');
    });

    it('should throw an error for invalid default value for INT datatype', () => {
        const tokens = [
            new IdentifierToken('id'),
            new DatatypeToken('INT'),
            new KeywordToken('DEFAULT'),
            new LiteralToken("'invalid'"),
        ];

        expect(
            () =>
                new ColumnDefinitionParser(tokens).parse() as ColumnDefinition,
        ).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse() as ColumnDefinition).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse() as ColumnDefinition).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse()).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse()).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse()).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);
        expect(() => parsedColumn.parse()).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse()).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse()).toThrow(
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

        const parsedColumn = new ColumnDefinitionParser(tokens);

        expect(() => parsedColumn.parse()).toThrow(
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
        const columnDefinitionAST = new ColumnDefinitionParser(tokens);

        const parsedColumn = columnDefinitionAST.parse() as ColumnDefinition;

        expect(parsedColumn.name).toBe('id');
        expect(parsedColumn.datatype).toBe(DatatypeEnum.INT);
        expect(parsedColumn.constraints).toContain('NOT_NULL');
        expect(parsedColumn.constraints).toContain('UNIQUE');
    });
});

describe('CreateTableAST parse method', () => {
    it('should throw an error for missing TABLE keyword', () => {
        const tokens = [new KeywordToken('CREATE')];
        const createTableParser = new CreateParser(tokens);

        expect(() => createTableParser.parse()).toThrow(
            "Expected 'TABLE' after 'CREATE', but found end of input.",
        );
    });

    it('should throw an error for missing table name', () => {
        const tokens = [new KeywordToken('CREATE'), new KeywordToken('TABLE')];
        const createTableParser = new CreateParser(tokens);

        expect(() => createTableParser.parse()).toThrow(
            "Expected table name after 'CREATE TABLE', but found end of input.",
        );
    });

    it('should throw an error for missing opening parenthesis', () => {
        const tokens = [
            new KeywordToken('CREATE'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
        ];
        const createTableParser = new CreateParser(tokens);

        expect(() => createTableParser.parse()).toThrow(
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
        const createTableParser = new CreateParser(tokens);

        expect(() => createTableParser.parse()).toThrow(
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
        const createTableParser = new CreateParser(tokens);

        expect(() => createTableParser.parse()).toThrow(
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

        const parsedAST = new CreateParser(tokens).parse() as CreateTableAST;

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

    it('should preserve datatype lengths before column constraints', () => {
        const parsedAST = new ParserGenerator(
            new Tokenizer().tokenize(
                'CREATE TABLE test (name CHAR(20) NOT NULL);',
            ),
        ).parse() as CreateTableAST;

        expect(parsedAST.columns[0].length).toBe(20);
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

        const createTableParser = new CreateParser(tokens);

        expect(() => createTableParser.parse()).toThrow(
            "Expected ')' after column definitions for table 'my_table', but found end of input.",
        );
    });

    it('should throw an error for the tokens that after the semicolon', () => {
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

        const createTableParser = new CreateParser(tokens);

        expect(() => createTableParser.parse()).toThrow(
            "Unexpected token 'WHERE' after CREATE TABLE statement at undefined.",
        );
    });
});

describe('DropTableAST parse method', () => {
    it('should be defined', () => {
        expect(new DropTableAST()).toBeDefined();
    });

    it('should throw an error for missing table name', () => {
        const tokens = [new KeywordToken('DROP'), new KeywordToken('TABLE')];
        const dropTableParser = new DropParser(tokens);

        expect(() => dropTableParser.parse()).toThrow(
            "Expected table name after 'DROP TABLE', but found end of input.",
        );
    });

    it('should throw an error for missing semicolon', () => {
        const tokens = [
            new KeywordToken('DROP'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
        ];
        const dropTableParser = new DropParser(tokens);

        expect(() => dropTableParser.parse()).toThrow(
            "Expected ';' after 'DROP TABLE my_table', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after semicolon', () => {
        const tokens = [
            new KeywordToken('DROP'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken(';'),
            new KeywordToken('WHERE'),
        ];
        const dropTableParser = new DropParser(tokens);

        expect(() => dropTableParser.parse()).toThrow(
            "Unexpected token 'WHERE' after DROP TABLE statement at undefined.",
        );
    });

    it('should correctly parse a valid DROP TABLE statement', () => {
        const tokens = [
            new KeywordToken('DROP'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken(';'),
        ];
        const dropTableParser = new DropParser(tokens);

        const parsedAST = dropTableParser.parse() as DropTableAST;

        expect(parsedAST.tableName).toBe('my_table');
    });

    it('should throw an error for unexpected token after DROP TABLE statement', () => {
        const tokens = [
            new KeywordToken('DROP'),
            new KeywordToken('TABLE'),
            new IdentifierToken('my_table'),
            new PunctuationToken(';'),
            new KeywordToken('WHERE'),
        ];
        const dropTableParser = new DropParser(tokens);

        expect(() => dropTableParser.parse()).toThrow(
            "Unexpected token 'WHERE' after DROP TABLE statement at undefined.",
        );
    });

    it('should throw an error for in complete IF EXISTS clause', () => {
        const tokens = [
            new KeywordToken('DROP'),
            new KeywordToken('TABLE'),
            new KeywordToken('IF'),
        ];
        const dropTableParser = new DropParser(tokens);

        expect(() => dropTableParser.parse()).toThrow(
            "Expected 'EXISTS' after 'IF' in DROP TABLE statement, but found end of input.",
        );
    });

    it('should throw an error for missing table name after IF EXISTS clause', () => {
        const tokens = [
            new KeywordToken('DROP'),
            new KeywordToken('TABLE'),
            new KeywordToken('IF'),
            new KeywordToken('EXISTS'),
        ];
        const dropTableParser = new DropParser(tokens);

        expect(() => dropTableParser.parse()).toThrow(
            "Expected table name after 'DROP TABLE IF EXISTS', but found end of input.",
        );
    });

    it('should correctly parse a valid DROP TABLE IF EXISTS statement', () => {
        const tokens = [
            new KeywordToken('DROP'),
            new KeywordToken('TABLE'),
            new KeywordToken('IF'),
            new KeywordToken('EXISTS'),
            new IdentifierToken('my_table'),
            new PunctuationToken(';'),
        ];
        const dropTableParser = new DropParser(tokens);

        const parsedAST = dropTableParser.parse() as DropTableAST;

        expect(parsedAST.tableName).toBe('my_table');
        expect(parsedAST.ifExists).toBe(true);
    });
});

describe('InsertAST parse method', () => {
    it('should be defined', () => {
        expect(new InsertAST()).toBeDefined();
    });
});
describe('UpdateAST parse method', () => {
    it('should be defined', () => {
        expect(new UpdateAST()).toBeDefined();
    });

    it('should throw an error for missing table name', () => {
        const tokens = [new KeywordToken('UPDATE')];
        const updateParser = new UpdateParser(tokens);

        expect(() => updateParser.parse()).toThrow(
            "Expected 'TABLE_NAME' after 'UPDATE', but found end of input.",
        );
    });

    it('should throw an error for missing SET keyword', () => {
        const tokens = [
            new KeywordToken('UPDATE'),
            new IdentifierToken('users'),
        ];
        const updateParser = new UpdateParser(tokens);

        expect(() => updateParser.parse()).toThrow(
            "Expected 'SET' after 'UPDATE users', but found end of input.",
        );
    });

    it('should throw an EOI error for missing column assignments', () => {
        const tokens = [
            new KeywordToken('UPDATE'),
            new IdentifierToken('users'),
            new KeywordToken('SET'),
        ];
        const updateParser = new UpdateParser(tokens);

        expect(() => updateParser.parse()).toThrow(
            'Expected at least one column assignment in UPDATE statement, but found none.',
        );
    });

    it('should throw an EOI error for missing WHERE keyword', () => {
        const tokens = [
            new KeywordToken('UPDATE'),
            new IdentifierToken('users'),
            new KeywordToken('SET'),
            new IdentifierToken('age'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('42'),
        ];
        const updateParser = new UpdateParser(tokens);

        expect(() => updateParser.parse()).toThrow(
            "Expected 'WHERE' after 'COLUMN_ASSIGNMENT', but found end of input.",
        );
    });

    it('should throw an error for missing semicolon', () => {
        const tokens = [
            new KeywordToken('UPDATE'),
            new IdentifierToken('users'),
            new KeywordToken('SET'),
            new IdentifierToken('age'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('42'),
            new KeywordToken('WHERE'),
            new IdentifierToken('id'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('1'),
        ];
        const updateParser = new UpdateParser(tokens);

        expect(() => updateParser.parse()).toThrow(
            "Expected ';' after 'WHERE id = 1', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after semicolon', () => {
        const tokens = [
            new KeywordToken('UPDATE'),
            new IdentifierToken('users'),
            new KeywordToken('SET'),
            new IdentifierToken('age'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('42'),
            new KeywordToken('WHERE'),
            new IdentifierToken('id'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('1'),
            new PunctuationToken(';'),
            new KeywordToken('WHERE'),
        ];
        const updateParser = new UpdateParser(tokens);

        expect(() => updateParser.parse()).toThrow(
            "Unexpected token 'WHERE' after UPDATE Statement at undefined.",
        );
    });

    it('should collect column assignments in an UPDATE statement', () => {
        const tokens = [
            new KeywordToken('UPDATE'),
            new IdentifierToken('users'),
            new KeywordToken('SET'),
            new IdentifierToken('age'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('42'),
            new PunctuationToken(','),
            new IdentifierToken('name'),
            new SingleCharacterOperatorToken('='),
            new LiteralToken("'John Doe'"),
            new KeywordToken('WHERE'),
            new IdentifierToken('id'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('1'),
            new PunctuationToken(';'),
        ];

        const updateAST = new UpdateParser(tokens).parse() as UpdateAST;

        expect(updateAST.columns).toEqual([
            { column: 'age', value: 42, isNull: false },
            { column: 'name', value: 'John Doe', isNull: false },
        ]);
    });
});

describe('DeleteAST parse method', () => {
    it('should be defined', () => {
        expect(new DeleteAST()).toBeDefined();
    });

    it('should throw an EOI error for missing FROM key word', () => {
        const tokens = [new KeywordToken('DELETE')];
        const deleteParser = new DeleteParser(tokens);

        expect(() => deleteParser.parse()).toThrow(
            "Expected 'FROM' after 'DELETE', but found end of input.",
        );
    });

    it('should throw an error for missing Table name', () => {
        const tokens = [
            new KeywordToken('DELETE'),
            new KeywordToken('FROM'),
            new KeywordToken('Where'),
        ];
        const deleteParser = new DeleteParser(tokens);

        expect(() => deleteParser.parse()).toThrow(
            "Expected 'table name' after 'DELETE FROM', but found 'Where' at undefined.",
        );
    });

    it('should not throw an error for missing WHERE key word', () => {
        const tokens = [
            new KeywordToken('DELETE'),
            new KeywordToken('FROM'),
            new IdentifierToken('test'),
            new PunctuationToken(';'),
        ];
        const deleteParser = new DeleteParser(tokens);

        expect(() => deleteParser.parse()).not.toThrow();
    });

    it('should throw an EOI error for missing semicolon', () => {
        const tokens = [
            new KeywordToken('DELETE'),
            new KeywordToken('FROM'),
            new IdentifierToken('test'),
        ];
        const deleteParser = new DeleteParser(tokens);

        expect(() => deleteParser.parse()).toThrow(
            "Expected 'WHERE' or ';' after 'DELETE FROM test', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after WHERE condition', () => {
        const tokens = [
            new KeywordToken('DELETE'),
            new KeywordToken('FROM'),
            new IdentifierToken('test'),
            new KeywordToken('WHERE'),
            new IdentifierToken('id'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('5'),
            new KeywordToken('WHERE'),
        ];
        const deleteParser = new DeleteParser(tokens);

        expect(() => deleteParser.parse()).toThrow(
            "Expected ';' after 'DELETE FROM test WHERE id = 5', but found 'WHERE' at undefined.",
        );
    });

    it('should throw an error for unexpected token after semicolon', () => {
        const tokens = [
            new KeywordToken('DELETE'),
            new KeywordToken('FROM'),
            new IdentifierToken('test'),
            new PunctuationToken(';'),
            new KeywordToken('WHERE'),
        ];
        const deleteParser = new DeleteParser(tokens);

        expect(() => deleteParser.parse()).toThrow(
            "Unexpected token 'WHERE' after DELETE Statement at undefined.",
        );
    });

    it('should parse where condition correctly', () => {
        const tokens = [
            new KeywordToken('DELETE'),
            new KeywordToken('FROM'),
            new IdentifierToken('test'),
            new KeywordToken('Where'),
            new IdentifierToken('id'),
            new SingleCharacterOperatorToken('='),
            new NumberToken('5'),
            new PunctuationToken(';'),
        ];
        const deleteParser = new DeleteParser(tokens);

        const ast = deleteParser.parse() as DeleteAST;
        expect(ast.tableName).toBe('test');
        expect(ast.whereCondition).toBeDefined();
        expect(ast.whereCondition?.leftOperand).toBe('id');
        expect(ast.whereCondition?.isLeftOperandColumn).toBe(true);
        expect(ast.whereCondition?.operator).toBe('=');
        expect(ast.whereCondition?.rightOperand).toBe(5);
        expect(ast.whereCondition?.isRightOperandColumn).toBe(false);
    });
});

describe('SelectAST parse method', () => {
    it('should be defined', () => {
        expect(new SelectAST()).toBeDefined();
    });

    it('should throw an error for missing FROM keyword', () => {
        const tokens = [new KeywordToken('SELECT'), new IdentifierToken('id')];
        const selectParser = new SelectParser(tokens);

        expect(() => selectParser.parse()).toThrow(
            "Expected 'FROM' after 'SELECT id', but found end of input.",
        );
    });

    it('should throw an error for missing table name after FROM', () => {
        const tokens = [
            new KeywordToken('SELECT'),
            new IdentifierToken('id'),
            new KeywordToken('FROM'),
        ];
        const selectParser = new SelectParser(tokens);

        expect(() => selectParser.parse()).toThrow(
            "Expected 'TABLE_NAME' after 'FROM', but found end of input.",
        );
    });

    it('should throw an error for missing semicolon at the end', () => {
        const tokens = [
            new KeywordToken('SELECT'),
            new IdentifierToken('id'),
            new KeywordToken('FROM'),
            new IdentifierToken('users'),
        ];
        const selectParser = new SelectParser(tokens);

        expect(() => selectParser.parse()).toThrow(
            "Expected ';' after 'SELECT statement', but found end of input.",
        );
    });

    it('should throw an error for unexpected token after semicolon', () => {
        const tokens = [
            new KeywordToken('SELECT'),
            new IdentifierToken('id'),
            new KeywordToken('FROM'),
            new IdentifierToken('users'),
            new PunctuationToken(';'),
            new KeywordToken('WHERE'),
        ];
        const selectParser = new SelectParser(tokens);

        expect(() => selectParser.parse()).toThrow(
            "Unexpected token 'WHERE' after SELECT statement at undefined.",
        );
    });

    it('should correctly parse a valid SELECT statement', () => {
        const tokens = [
            new KeywordToken('SELECT'),
            new IdentifierToken('id'),
            new PunctuationToken(','),
            new IdentifierToken('name'),
            new KeywordToken('FROM'),
            new IdentifierToken('users'),
            new KeywordToken('WHERE'),
            new IdentifierToken('age'),
            new SingleCharacterOperatorToken('>'),
            new NumberToken('18'),
            new KeywordToken('ORDER'),
            new KeywordToken('BY'),
            new IdentifierToken('name'),
            new KeywordToken('ASC'),
            new PunctuationToken(';'),
        ];
        const selectParser = new SelectParser(tokens);

        const parsedAST = selectParser.parse() as SelectAST;

        expect(parsedAST.selectColumns).toEqual([
            { name: 'id' },
            { name: 'name' },
        ]);
        expect(parsedAST.from).toEqual([{ tableName: 'users' }]);
        expect(parsedAST.whereClause).toBeDefined();
        expect(parsedAST.whereClause?.leftOperand).toBe('age');
        expect(parsedAST.whereClause?.operator).toBe('>');
        expect(parsedAST.whereClause?.rightOperand).toBe(18);
        expect(parsedAST.orderByClause).toEqual({
            column: { name: 'name' },
            direction: OrderDirection.ASC,
        });
    });

    it('should correctly parse a SELECT statement with *', () => {
        const tokens = [
            new KeywordToken('SELECT'),
            new SingleCharacterOperatorToken('*'),
            new KeywordToken('FROM'),
            new IdentifierToken('users'),
            new PunctuationToken(';'),
        ];
        const selectParser = new SelectParser(tokens);

        const parsedAST = selectParser.parse() as SelectAST;

        expect(parsedAST.selectColumns).toBe('*');
        expect(parsedAST.from).toEqual([{ tableName: 'users' }]);
    });
});
