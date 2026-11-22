import { SyntaxErrorException } from '../../exceptions/syntax-error.exc.js';
import {
    KeywordToken,
    PunctuationToken,
    SingleCharacterOperatorToken,
    Token,
    TokenType,
} from '../../tokenizer/token.class.js';
import {
    FromClause,
    OrderByClause,
    OrderDirection,
    SelectClause,
} from '../ast/ast.class.js';
import { WhereClauseAST } from '../ast/dml/where-clause.ast.js';
import { SelectAST } from '../ast/select.class.js';
import { Parser } from '../parser.class.js';
import { WhereParser } from './where.parser.js';

export class SelectParser extends Parser {
    private selectAST: SelectAST;
    constructor(tokens: Token[]) {
        super(tokens);
        this.selectAST = new SelectAST();
    }

    private stringifySelectColumns(): string {
        if (this.selectAST.selectColumns === '*') {
            return '*';
        }

        return this.selectAST.selectColumns
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
                this.selectAST.missedTokenError(
                    'Column reference identifier',
                    this.peek()?.value || null,
                    this.peek()?.position || null,
                    'SELECT' +
                        (this.selectAST.selectColumns.length > 0
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
            this.selectAST.missedTokenError(
                'Column name',
                columnNameToken?.value || null,
                columnNameToken?.position || null,
                'SELECT' +
                    (this.selectAST.selectColumns.length > 0
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
                this.selectAST.missedTokenError(
                    'Alias name',
                    aliasToken?.value || null,
                    aliasToken?.position || null,
                    'SELECT' +
                        (this.selectAST.selectColumns.length > 0
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
                    this.selectAST.missedTokenError(
                        'Non-empty alias name',
                        aliasToken?.value || null,
                        aliasToken?.position || null,
                        'SELECT' +
                            (this.selectAST.selectColumns.length > 0
                                ? ` ${this.stringifySelectColumns()}, `
                                : '') +
                            (column.from ? `${column.from}.` : '') +
                            `${column.name} AS `,
                    );
                }
                column.as = this.consume()!.value.slice(1, -1); // Remove quotes
            }
        }

        (this.selectAST.selectColumns as SelectClause[]).push(column);

        if (this.expect(new PunctuationToken(','))) {
            this.consume();
            this.parseSelectColumns();
        }
    }

    private isTableExists(table: FromClause, position: string): void {
        const tableExists = this.selectAST.from.find(
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
            this.selectAST.missedTokenError(
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
        this.selectAST.from.push(table);

        if (this.expect(new PunctuationToken(','))) {
            this.consume();
            this.parseFromClause();
        }
    }

    private parseCondition(): WhereClauseAST {
        const whereParser = new WhereParser(this.tokens);
        const remainingBefore = whereParser.tokens.length;
        const whereCondition = whereParser.parse(
            this.selectAST.from,
        ) as WhereClauseAST;
        const consumed = remainingBefore - whereParser.tokens.length;

        this.consume(0, consumed);

        return whereCondition;
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
                this.selectAST.missedTokenError(
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
            this.selectAST.missedTokenError(
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

        this.selectAST.orderByClause = orderBy;
    }

    public parse(): SelectAST | null {
        this.consume(); // Consume the SELECT token

        if (this.expect(new SingleCharacterOperatorToken('*'))) {
            this.selectAST.selectColumns = '*';
            this.consume(); // Consume the '*' token
        } else {
            const token = this.peek();
            if (token === null || token.type !== TokenType.IDENTIFIER) {
                this.selectAST.missedTokenError(
                    'Column name or *',
                    this.peek()?.value || null,
                    this.peek()?.position || null,
                    'SELECT',
                );
            }
            this.selectAST.selectColumns = [];
            this.parseSelectColumns();
        }

        if (!this.expect(new KeywordToken('FROM'))) {
            const columns = this.stringifySelectColumns();
            this.selectAST.missedTokenError(
                'FROM',
                this.peek()?.value || null,
                this.peek()?.position || null,
                `SELECT ${columns}`,
            );
        }

        this.consume(); // Consume the FROM token
        this.selectAST.from = [];
        this.parseFromClause();

        if (this.expect(new KeywordToken('WHERE'))) {
            this.consume(); // Consume the WHERE token
            this.selectAST.whereClause = this.parseCondition();
        }

        if (this.expect(new KeywordToken('ORDER'))) {
            this.consume(); // Consume the ORDER token
            if (!this.expect(new KeywordToken('BY'))) {
                this.selectAST.missedTokenError(
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
                this.selectAST.missedTokenError(
                    'LIMIT value',
                    limitToken?.value || null,
                    limitToken?.position || null,
                    'LIMIT',
                );
            }

            this.selectAST.limit = parseInt(limitToken.value, 10);
            this.consume(); // Consume the LIMIT value token
        }

        if (!this.expect(new PunctuationToken(';'))) {
            this.selectAST.missedTokenError(
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
        return this.selectAST;
    }
}
