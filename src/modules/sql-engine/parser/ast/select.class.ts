import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    TokenType,
} from '../../tokenizer/token.class.js';
import { ParserGenerator } from '../parser.js';
import {
    DMLType,
    FromClause,
    MainClassAST,
    OrderByClause,
    OrderDirection,
    SelectClause,
} from './ast.class.js';
import { WhereClauseAST } from './dml/where-clause.ast.js';

export class SelectAST extends MainClassAST {
    private _from: FromClause[];
    private _selectColumns: SelectClause[] | `*`;
    private _whereClause: WhereClauseAST;
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
    public get whereClause(): WhereClauseAST {
        return this._whereClause;
    }
    public set whereClause(value: WhereClauseAST) {
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
        this.whereClause = new WhereClauseAST().parse(
            this.parser,
            this.from,
        ) as WhereClauseAST;
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

    public parse(parser: ParserGenerator): SelectAST | null {
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
