import { Injectable } from '@nestjs/common';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { Validator, ValidatorIF } from '../validator.js';
import {
    FromClause,
    SelectAST,
    SelectClause,
} from '../../parser/ast/select.class.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';
import { WhereCondition } from '../../parser/ast/dml/dml.class.js';

@Injectable()
export class SelectValidator implements ValidatorIF {
    private ast: SelectAST;

    constructor(private readonly tableManager: TableManager) {}

    public async validate(ast: SelectAST): Promise<void> {
        for (const fromClause of ast.from) {
            await Validator.validateIsTableExists(
                fromClause.tableName,
                this.tableManager,
            );

            fromClause.schema = await this.tableManager.getTableSchema(
                fromClause.tableName,
            );
        }

        if (ast.selectColumns !== '*' && ast.selectColumns.length === 0) {
            throw new ExecutionErrorException(
                `No columns specified for selection in SELECT statement.`,
            );
        }

        if (ast.selectColumns !== '*' && ast.selectColumns.length > 0) {
            for (const selectColumn of ast.selectColumns) {
                let table: FromClause | undefined;

                if (selectColumn.from) {
                    table = ast.from.find(
                        (fromClause) =>
                            fromClause.alias === selectColumn.from ||
                            fromClause.tableName === selectColumn.from,
                    );
                } else if (ast.from.length === 1) {
                    table = ast.from[0];
                } else {
                    const matchingTables = ast.from.filter((fromClause) =>
                        fromClause.schema?.columnsName?.includes(
                            selectColumn.name,
                        ),
                    );

                    if (matchingTables.length === 1) {
                        table = matchingTables[0];
                    } else if (matchingTables.length > 1) {
                        throw new ExecutionErrorException(
                            `Ambiguous column '${selectColumn.name}' in the SELECT clause.`,
                        );
                    }
                }

                if (!table) {
                    if (!selectColumn.from) {
                        throw new ExecutionErrorException(
                            `Column '${selectColumn.name}' does not exist in any FROM table.`,
                        );
                    }
                    throw new ExecutionErrorException(
                        `Table alias '${selectColumn.from}' does not exist in the FROM clause.`,
                    );
                }

                if (table.schema?.columnsName?.includes(selectColumn.name)) {
                    selectColumn.tableName = table.tableName;
                } else {
                    throw new ExecutionErrorException(
                        `Column '${selectColumn.name}' does not exist in table '${table.tableName}'.`,
                    );
                }
            }
        }

        this.ast = ast;
        this.checkWhereClause();

        this.checkOrderByClause();

        if (ast.limit !== null && ast.limit < 0) {
            throw new ExecutionErrorException(
                `LIMIT value cannot be negative. Received: ${ast.limit}`,
            );
        }
    }

    private checkWhereClause(): void {
        const whereClause = this.ast.whereClause;
        if (!whereClause) {
            return;
        }

        if (whereClause.isRightOperandColumn) {
            this.validateWhereColumn(
                whereClause.rightColumnRef,
                whereClause.rightOperand,
                true,
            );
        }

        if (whereClause.isLeftOperandColumn) {
            this.validateWhereColumn(
                whereClause.leftColumnRef,
                whereClause.leftOperand,
                false,
            );
        }
    }

    private validateWhereColumn(
        columnRef: string | undefined,
        operand: WhereCondition['rightOperand'],
        isRightOperand: boolean,
    ): void {
        let table: FromClause | undefined;

        if (columnRef) {
            table = this.ast.from.find(
                (fromClause) =>
                    fromClause.alias === columnRef ||
                    fromClause.tableName === columnRef,
            );

            if (!table) {
                throw new ExecutionErrorException(
                    `Table '${columnRef}' does not exist in the FROM clause.`,
                );
            }
        } else {
            table = this.ast.from.length === 1 ? this.ast.from[0] : undefined;

            if (!table) {
                throw new ExecutionErrorException(
                    `Column '${operand}' must be qualified when selecting from multiple tables.`,
                );
            }

            if (isRightOperand) {
                this.ast.whereClause.rightColumnRef =
                    table.alias || table.tableName;
            } else {
                this.ast.whereClause.leftColumnRef =
                    table.alias || table.tableName;
            }
        }

        if (!table.schema?.columnsName?.includes(operand as string)) {
            throw new ExecutionErrorException(
                `Column '${operand}' does not exist in table '${table.tableName}'.`,
            );
        }

        if (isRightOperand) {
            this.ast.whereClause.rightOperand =
                WhereCondition.validateWhereOperandAsColumn(
                    this.ast.whereClause.rightOperand,
                    table.schema!,
                );
        } else {
            this.ast.whereClause.leftOperand =
                WhereCondition.validateWhereOperandAsColumn(
                    this.ast.whereClause.leftOperand,
                    table.schema!,
                );
        }
    }

    private checkOrderByClause(): void {
        if (!this.ast.orderByClause) {
            return;
        }

        if (this.ast.orderByClause.column.from) {
            const table = this.ast.from.find(
                (fromClause) =>
                    fromClause.alias === this.ast.orderByClause!.column.from ||
                    fromClause.tableName ===
                        this.ast.orderByClause!.column.from,
            );

            if (!table) {
                throw new ExecutionErrorException(
                    `Table alias '${this.ast.orderByClause.column.from}' does not exist in the FROM clause.`,
                );
            }
        }

        let orderByColumn = this.ast.from.find((fromClause) =>
            fromClause.schema?.columnsName?.includes(
                this.ast.orderByClause!.column.name,
            ),
        );

        if (!orderByColumn) {
            throw new ExecutionErrorException(
                `Column '${this.ast.orderByClause.column.name}' does not exist in` +
                    (this.ast.from.length === 1
                        ? ` table '${this.ast.from[0].tableName}'.`
                        : ` any of the tables in the FROM clause.`),
            );
        }
    }
}
