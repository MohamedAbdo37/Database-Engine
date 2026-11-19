import { Catalog } from '../../../storage/dto/catalog.dto.js';
import { WhereOperator } from '../../../storage/table-manager/table-manager.js';
import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    MultiCharacterOperatorToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import { ParserGenerator } from '../parser.js';
import { AST, DMLType, MainClassAST } from './ast.class.js';
import { WhereCondition } from './dml/dml.class.js';

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

export class SelectAST extends MainClassAST {
    private parser: ParserGenerator;
    private _from: FromClause[];
    private _selectColumns: SelectClause[] | `*`;
    private _whereClause: WhereCondition;
    private _orderByClause: OrderByClause;
    private _limit: number | null;

    public get from(): FromClause[] {
        return this._from;
    }
    public set from(value: FromClause[]) {
        this._from = value;
    }
    public get selectColumns(): SelectClause[] | `*` {
        return this._selectColumns;
    }
    public set selectColumns(value: SelectClause[] | `*`) {
        this._selectColumns = value;
    }
    public get whereClause(): WhereCondition {
        return this._whereClause;
    }
    public set whereClause(value: WhereCondition) {
        this._whereClause = value;
    }
    public get orderByClause(): OrderByClause {
        return this._orderByClause;
    }
    public set orderByClause(value: OrderByClause) {
        this._orderByClause = value;
    }
    public get limit(): number | null {
        return this._limit;
    }
    public set limit(value: number | null) {
        this._limit = value;
    }

    private peek(): Token | null {
        return this.parser.peek();
    }

    private next(): Token | null {
        return this.parser.next();
    }

    private consume(): Token | null {
        return this.parser.consume();
    }

    private expect(expectedToken: Token): boolean {
        return this.parser.expect(expectedToken);
    }

    constructor() {
        super(DMLType.SELECT);
    }

    private stringifySelectColumns(): string {
        if (this.selectColumns === '*') {
            return '*';
        }

        return this.selectColumns
            .map(({ from, name, as }) => {
                const columnName = from ? `${from}.${name}` : name;
                return as ? `${columnName} AS ${as}` : columnName;
            })
            .join(', ');
    }

    private isColumnExists(column: SelectClause, position: string): void {
        if (this.selectColumns === '*') {
            throw new Error(
                'Cannot check for column existence when selectColumns is set to "*".',
            );
        }

        const columnExists = this.selectColumns.find(
            (col) => col.name === column.name,
        );

        if (!columnExists) {
            return;
        }

        if (!column.from) {
            throw new SyntaxErrorException(
                `Ambiguous column reference '${column.name}' at ${position}. The column exists in multiple tables, but no table alias or name was provided to disambiguate it.`,
            );
        }

        if (column.from === columnExists.from) {
            throw new SyntaxErrorException(
                `Duplicate column reference '${column.name}' from table '${column.from}' at ${position}. The same column is being selected multiple times.`,
            );
        }
    }

    private parseSelectColumns(): void {
        const column: SelectClause = {
            name: '',
            from: undefined,
            as: undefined,
        };
        const dotToken = this.next();

        if (dotToken !== null && dotToken.equals(new PunctuationToken('.'))) {
            if (
                this.peek() === null ||
                this.peek()!.type !== TokenType.IDENTIFIER
            ) {
                this.missedTokenError(
                    'Column reference identifier',
                    this.peek()?.value || null,
                    this.peek()?.position || null,
                    'SELECT' +
                        (this.selectColumns.length > 0
                            ? ` ${this.stringifySelectColumns()}, `
                            : ''),
                );
            }
            column.from = this.consume()!.value;
            this.consume(); // Consume the '.' token
        }

        const columnNameToken = this.peek();
        if (
            columnNameToken === null ||
            columnNameToken.type !== TokenType.IDENTIFIER
        ) {
            this.missedTokenError(
                'Column name',
                columnNameToken?.value || null,
                columnNameToken?.position || null,
                'SELECT' +
                    (this.selectColumns.length > 0
                        ? ` ${this.stringifySelectColumns()}, `
                        : '') +
                    (column.from ? `${column.from}.` : ''),
            );
        }

        this.isColumnExists(column, columnNameToken.position);
        column.name = this.consume()!.value;

        if (this.expect(new KeywordToken('AS'))) {
            this.consume(); // Consume the AS token
            const aliasToken = this.peek();
            if (
                aliasToken === null ||
                (aliasToken.type !== TokenType.IDENTIFIER &&
                    aliasToken.type !== TokenType.LITERAL)
            ) {
                this.missedTokenError(
                    'Alias name',
                    aliasToken?.value || null,
                    aliasToken?.position || null,
                    'SELECT' +
                        (this.selectColumns.length > 0
                            ? ` ${this.stringifySelectColumns()}, `
                            : '') +
                        (column.from ? `${column.from}.` : '') +
                        `${column.name} AS `,
                );
            }

            if (aliasToken.type === TokenType.IDENTIFIER)
                column.as = this.consume()!.value;
            else {
                if (aliasToken.value.slice(1, -1).trim() === '') {
                    this.missedTokenError(
                        'Non-empty alias name',
                        aliasToken?.value || null,
                        aliasToken?.position || null,
                        'SELECT' +
                            (this.selectColumns.length > 0
                                ? ` ${this.stringifySelectColumns()}, `
                                : '') +
                            (column.from ? `${column.from}.` : '') +
                            `${column.name} AS `,
                    );
                }
                column.as = this.consume()!.value.slice(1, -1); // Remove quotes
            }
        }

        (this.selectColumns as SelectClause[]).push(column);

        if (this.expect(new PunctuationToken(','))) {
            this.consume();
            this.parseSelectColumns();
        }
    }

    private isTableExists(table: FromClause, position: string): void {
        const tableExists = this.from.find(
            (tbl) => tbl.tableName === table.tableName,
        );

        if (!tableExists) {
            return;
        }

        if (!table.alias) {
            throw new SyntaxErrorException(
                `Ambiguous table reference '${table.tableName}' at ${position}. The table exists in the FROM clause, but no alias was provided to disambiguate it.`,
            );
        }

        if (table.alias === tableExists.alias)
            throw new SyntaxErrorException(
                `Duplicate table reference '${table.tableName}' with alias '${table.alias}' at ${position}. The same table is being referenced multiple times with the same alias.`,
            );
    }

    private parseFromClause(): void {
        const table: FromClause = { tableName: '', alias: undefined };
        const tableNameToken = this.peek();
        if (
            tableNameToken === null ||
            tableNameToken.type !== TokenType.IDENTIFIER
        ) {
            this.missedTokenError(
                'TABLE_NAME',
                tableNameToken?.value || null,
                tableNameToken?.position || null,
                'FROM',
            );
        }
        table.tableName = this.consume()!.value;

        if (
            this.peek() !== null &&
            this.peek()!.type === TokenType.IDENTIFIER
        ) {
            table.alias = this.consume()!.value;
        }

        this.isTableExists(table, tableNameToken.position);
        this.from.push(table);

        if (this.expect(new PunctuationToken(','))) {
            this.consume();
            this.parseFromClause();
        }
    }

    private parseWhereClause(): void {
        const whereCondition: WhereCondition = {
            leftOperand: null,
            isLeftOperandColumn: false,
            leftColumnRef: undefined,
            operator: WhereOperator.EQUALS,
            rightOperand: null,
            isRightOperandColumn: false,
            rightColumnRef: undefined,
        };
        const openPrenticesToken: Token[] = [];
        while (this.expect(new PunctuationToken('('))) {
            openPrenticesToken.push(this.peek()!);
            this.consume(); // Consume the '(' token
        }

        const leftToken = this.peek();
        if (
            !leftToken ||
            (leftToken.type !== TokenType.IDENTIFIER &&
                leftToken.type !== TokenType.LITERAL &&
                leftToken.type !== TokenType.NUMBER &&
                leftToken.type !== TokenType.KEYWORD)
        ) {
            this.missedTokenError(
                'left_operand',
                leftToken ? leftToken.value : null,
                leftToken ? leftToken.position : null,
                'WHERE',
            );
        }
        if (leftToken.equals(new KeywordToken('NULL'))) {
            throw new SyntaxErrorException(
                `Unexpected token 'NULL' at ${leftToken.position}. 'NULL' cannot be used as a left operand in a WHERE condition.`,
            );
        } else if (leftToken.type === TokenType.LITERAL) {
            whereCondition.leftOperand = leftToken.value.slice(1, -1); // Remove the surrounding quotes
        } else if (leftToken.type === TokenType.NUMBER) {
            whereCondition.leftOperand = Number(leftToken.value);
        } else if (
            leftToken.equals(new KeywordToken('TRUE')) ||
            leftToken.equals(new KeywordToken('FALSE'))
        ) {
            whereCondition.leftOperand = leftToken.equals(
                new KeywordToken('TRUE'),
            )
                ? 1
                : 0;
        } else if (leftToken.type === TokenType.IDENTIFIER) {
            whereCondition.leftOperand = leftToken.value;
            whereCondition.isLeftOperandColumn = true;
        } else {
            this.missedTokenError(
                'VALUE',
                leftToken.value,
                leftToken.position,
                `${leftToken.value} =`,
            );
        }

        this.consume(); // Consume the left operand token

        while (this.expect(new PunctuationToken(')'))) {
            if (openPrenticesToken.length === 0) {
                const foundToken = this.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            openPrenticesToken.pop();
            this.consume(); // Consume the ')' token
        }

        const operatorToken = this.peek();

        if (
            !operatorToken ||
            (operatorToken.type !== TokenType.SINGLE_CHARACTER_OPERATOR &&
                operatorToken.type !== TokenType.MULTI_CHARACTER_OPERATOR &&
                operatorToken.equals(new KeywordToken('IS')) === false)
        ) {
            this.missedTokenError(
                'operator',
                operatorToken ? operatorToken.value : null,
                operatorToken ? operatorToken.position : null,
                `${whereCondition.leftOperand}`,
            );
        }

        switch (true) {
            case operatorToken.equals(new SingleCharacterOperatorToken('=')):
                whereCondition.operator = WhereOperator.EQUALS;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('>')):
                whereCondition.operator = WhereOperator.GREATER_THAN;
                break;
            case operatorToken.equals(new SingleCharacterOperatorToken('<')):
                whereCondition.operator = WhereOperator.LESS_THAN;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('>=')):
                whereCondition.operator = WhereOperator.GREATER_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('<=')):
                whereCondition.operator = WhereOperator.LESS_THAN_OR_EQUAL;
                break;
            case operatorToken.equals(new MultiCharacterOperatorToken('!=')):
                whereCondition.operator = WhereOperator.NOT_EQUALS;
                break;
            case operatorToken.equals(new KeywordToken('IS')):
                this.consume(); // Consume the 'IS' operator token2
                whereCondition.operator = WhereOperator.EQUALS;
                if (
                    this.next() !== null &&
                    this.next()?.equals(new KeywordToken('NOT'))
                ) {
                    whereCondition.operator = WhereOperator.NOT_EQUALS;
                    this.consume(); // Consume the 'NOT' token
                }

                if (!this.expect(new KeywordToken('NULL'))) {
                    this.missedTokenError(
                        'NULL',
                        this.peek() ? this.peek()!.value : null,
                        this.peek() ? this.peek()!.position : null,
                        `${whereCondition.leftOperand} IS${
                            whereCondition.operator === WhereOperator.NOT_EQUALS
                                ? ' NOT'
                                : ''
                        }`,
                    );
                }
                whereCondition.rightOperand = null;
                whereCondition.isRightOperandColumn = false;
                this.whereClause = whereCondition;
                this.consume(); // Consume the 'NULL' token

                while (this.expect(new PunctuationToken(')'))) {
                    if (openPrenticesToken.length === 0) {
                        const foundToken = this.peek();
                        throw new SyntaxErrorException(
                            `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                        );
                    }
                    openPrenticesToken.pop();
                    this.consume(); // Consume the ')' token
                }

                return; // Exit the function as we have handled the IS [NOT] NULL case
            default:
                this.missedTokenError(
                    'OPERATOR',
                    operatorToken ? operatorToken.value : null,
                    operatorToken ? operatorToken.position : null,
                    `${whereCondition.leftOperand}`,
                );
        }

        this.consume(); // Consume the operator token

        while (this.expect(new PunctuationToken('('))) {
            openPrenticesToken.push(this.peek()!);
            this.consume(); // Consume the '(' token
        }

        const rightToken = this.peek();

        if (
            !rightToken ||
            (rightToken.type !== TokenType.IDENTIFIER &&
                rightToken.type !== TokenType.LITERAL &&
                rightToken.type !== TokenType.NUMBER &&
                rightToken.type !== TokenType.KEYWORD)
        ) {
            this.missedTokenError(
                'left_operand',
                rightToken ? rightToken.value : null,
                rightToken ? rightToken.position : null,
                'WHERE',
            );
        }
        if (rightToken.equals(new KeywordToken('NULL'))) {
            throw new SyntaxErrorException(
                `Invalid NULL comparison at ${rightToken.position}. NULL must be compared using IS NULL or IS NOT NULL, not as a direct right-hand operand.`,
            );
        } else if (rightToken.type === TokenType.LITERAL) {
            whereCondition.rightOperand = rightToken.value.slice(1, -1); // Remove the surrounding quotes
        } else if (rightToken.type === TokenType.NUMBER) {
            whereCondition.rightOperand = Number(rightToken.value);
        } else if (
            rightToken.equals(new KeywordToken('TRUE')) ||
            rightToken.equals(new KeywordToken('FALSE'))
        ) {
            whereCondition.rightOperand = rightToken.equals(
                new KeywordToken('TRUE'),
            )
                ? 1
                : 0;
        } else if (rightToken.type === TokenType.IDENTIFIER) {
            whereCondition.rightOperand = rightToken.value;
            whereCondition.isRightOperandColumn = true;
        } else {
            this.missedTokenError(
                'VALUE',
                rightToken.value,
                rightToken.position,
                `${rightToken.value} =`,
            );
        }
        this.consume(); // Consume the right operand token

        while (this.expect(new PunctuationToken(')'))) {
            if (openPrenticesToken.length === 0) {
                const foundToken = this.peek();
                throw new SyntaxErrorException(
                    `Detected a closing parenthesis ')' at ${foundToken?.position} without a corresponding opening parenthesis '('.`,
                );
            }
            openPrenticesToken.pop();
            this.consume(); // Consume the ')' token
        }

        if (openPrenticesToken.length > 0) {
            if (!this.expect(new PunctuationToken(')'))) {
                throw new SyntaxErrorException(
                    `Detected an opening parenthesis '(' at ${openPrenticesToken[0].position} but no corresponding closing parenthesis ')' was found.`,
                );
            }
        }

        this.whereClause = whereCondition;
    }

    private parseOrderByClause(): void {
        const orderBy: OrderByClause = {
            column: { name: '', from: undefined },
            direction: OrderDirection.ASC,
        };

        const dotToken = this.next();
        if (dotToken !== null && dotToken.equals(new PunctuationToken('.'))) {
            if (
                this.peek() === null ||
                this.peek()!.type !== TokenType.IDENTIFIER
            ) {
                this.missedTokenError(
                    'Column reference identifier',
                    this.peek()?.value || null,
                    this.peek()?.position || null,
                    'ORDER BY',
                );
            }
            orderBy.column.from = this.consume()!.value;
            this.consume(); // Consume the '.' token
        }

        const columnNameToken = this.peek();
        if (
            columnNameToken === null ||
            columnNameToken.type !== TokenType.IDENTIFIER
        ) {
            this.missedTokenError(
                'Column name',
                columnNameToken?.value || null,
                columnNameToken?.position || null,
                'ORDER BY' +
                    (orderBy.column.from ? ` ${orderBy.column.from}.` : ''),
            );
        }

        orderBy.column.name = this.consume()!.value;

        if (this.expect(new KeywordToken('ASC'))) {
            orderBy.direction = OrderDirection.ASC;
            this.consume(); // Consume the ASC token
        } else if (this.expect(new KeywordToken('DESC'))) {
            orderBy.direction = OrderDirection.DESC;
            this.consume(); // Consume the DESC token
        }

        this.orderByClause = orderBy;
    }

    public parse(parser: ParserGenerator): AST | null {
        this.parser = parser;
        this.consume(); // Consume the SELECT token

        if (this.expect(new SingleCharacterOperatorToken('*'))) {
            this.selectColumns = '*';
            this.consume(); // Consume the '*' token
        } else {
            const token = this.peek();
            if (token === null || token.type !== TokenType.IDENTIFIER) {
                this.missedTokenError(
                    'Column name or *',
                    this.peek()?.value || null,
                    this.peek()?.position || null,
                    'SELECT',
                );
            }
            this.selectColumns = [];
            this.parseSelectColumns();
        }

        if (!this.expect(new KeywordToken('FROM'))) {
            const columns = this.stringifySelectColumns();
            this.missedTokenError(
                'FROM',
                this.peek()?.value || null,
                this.peek()?.position || null,
                `SELECT ${columns}`,
            );
        }

        this.consume(); // Consume the FROM token
        this.from = [];
        this.parseFromClause();

        if (this.expect(new KeywordToken('WHERE'))) {
            this.consume(); // Consume the WHERE token
            this.parseWhereClause();
        }

        if (this.expect(new KeywordToken('ORDER'))) {
            this.consume(); // Consume the ORDER token
            if (!this.expect(new KeywordToken('BY'))) {
                this.missedTokenError(
                    'BY',
                    this.peek()?.value || null,
                    this.peek()?.position || null,
                    'ORDER',
                );
            }

            this.consume(); // Consume the BY token
            this.parseOrderByClause();
        }

        if (this.expect(new KeywordToken('LIMIT'))) {
            this.consume();
            const limitToken = this.peek();
            if (limitToken === null || limitToken.type !== TokenType.NUMBER) {
                this.missedTokenError(
                    'LIMIT value',
                    limitToken?.value || null,
                    limitToken?.position || null,
                    'LIMIT',
                );
            }

            this.limit = parseInt(limitToken.value, 10);
            this.consume(); // Consume the LIMIT value token
        }

        if (!this.expect(new PunctuationToken(';'))) {
            this.missedTokenError(
                ';',
                this.peek()?.value || null,
                this.peek()?.position || null,
                'SELECT statement',
            );
        }
        this.consume(); // Consume the semicolon

        if (this.peek() !== null) {
            throw new SyntaxErrorException(
                `Unexpected token '${this.peek()?.value}' after SELECT statement at ${this.peek()?.position}.\nExpected end of input after SELECT statement.`,
            );
        }

        return this; // Return the current instance of Select AST
    }
}
