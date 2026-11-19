import { Injectable } from '@nestjs/common';
import { TableManager } from '../../storage/table-manager/table-manager.js';
import { DDLType, DMLType, MainClassAST } from '../parser/ast/ast.class.js';
import { CreateTableAST } from '../parser/ast/ddl/create-table.ast.js';
import { ExecutionErrorException } from '../exceptions/execution-error.exc.js';
import { DropTableAST } from '../parser/ast/ddl/drop-table.ast.js';
import { InsertAST } from '../parser/ast/dml/insert.ast.js';
import { Datatype } from '../../storage/dto/datatype.dto.js';
import { UpdateAST } from '../parser/ast/dml/update.ast.js';
import { Column, Table } from '../../storage/table-manager/table.dto.js';
import { DeleteAST } from '../parser/ast/dml/delete.ast.js';
import { SelectAST, SelectClause } from '../parser/ast/select.class.js';
import { CreateExecutor } from './executors/create.executor.js';
import { DropExecutor } from './executors/drop.executor.js';
import { InsertExecutor } from './executors/insert.executor.js';
import { UpdateExecutor } from './executors/update.executor.js';

export interface ExecutorIF {
    execute(ast: MainClassAST): Promise<void>;
}

@Injectable()
export class Executor {
    constructor(
        private readonly tableManager: TableManager,
        private readonly createExecutor: CreateExecutor,
        private readonly dropExecutor: DropExecutor,
        private readonly insertExecutor: InsertExecutor,
        private readonly updateExecutor: UpdateExecutor,
    ) {}

    public async execute(ast: MainClassAST): Promise<void> {
        switch (ast.type) {
            case DDLType.CREATE_TABLE:
                await this.createExecutor.execute(ast as CreateTableAST);
                break;
            case DDLType.DROP_TABLE:
                await this.dropExecutor.execute(ast as DropTableAST);
                break;
            case DDLType.ALTER_TABLE:
                // Implement alter table logic here
                break;
            case DMLType.INSERT:
                await this.insertExecutor.execute(ast as InsertAST);
                break;
            case DMLType.SELECT:
                await this.executeSelect(ast as SelectAST);
                break;
            case DMLType.UPDATE:
                await this.updateExecutor.execute(ast as UpdateAST);
                break;
            case DMLType.DELETE:
                await this.executeDelete(ast as DeleteAST);
                break;
            default:
                throw new Error(`Unsupported AST type: ${ast.type}`);
        }
    }

    private async executeDelete(ast: DeleteAST): Promise<void> {
        const isTableExists = await this.tableManager.isTableExists(
            ast.tableName,
        );

        if (!isTableExists) {
            throw new ExecutionErrorException(
                `Table '${ast.tableName}' does not exist. Cannot perform delete operation.`,
            );
        }

        const table: Table = await this.tableManager.scanTable(ast.tableName);

        if (!ast.whereCondition) {
            await this.tableManager.deleteRecords(ast.tableName, table.rows);
            return;
        }

        let filteredTable: Table;

        let rightOperandValue: any;
        let leftOperandValue: any;

        const schema = await this.tableManager.getTableSchema(ast.tableName);

        if (ast.whereCondition.isRightOperandColumn) {
            const schemaColumn = schema.columns.find(
                (col) => col.name === ast.whereCondition!.rightOperand,
            );

            if (!schemaColumn) {
                throw new ExecutionErrorException(
                    `Column '${ast.whereCondition.rightOperand}' does not exist in table '${ast.tableName}'.`,
                );
            }

            const column: Column = {
                name: schemaColumn.name,
                datatype: Datatype.getDatatypeInstance(
                    schemaColumn?.datatype,
                    schemaColumn.value,
                ),
                id: schemaColumn.id,
                isPrimary: schemaColumn.isPrimary,
                isUnique: schemaColumn.isUnique,
            };

            rightOperandValue = column;
        } else rightOperandValue = ast.whereCondition.rightOperand;

        if (ast.whereCondition.isLeftOperandColumn) {
            const schemaColumn = schema.columns.find(
                (col) => col.name === ast.whereCondition!.leftOperand,
            );

            if (!schemaColumn) {
                throw new ExecutionErrorException(
                    `Column '${ast.whereCondition.leftOperand}' does not exist in table '${ast.tableName}'.`,
                );
            }

            const column: Column = {
                name: schemaColumn.name,
                datatype: Datatype.getDatatypeInstance(
                    schemaColumn?.datatype,
                    schemaColumn.value,
                ),
                id: schemaColumn.id,
                isPrimary: schemaColumn.isPrimary,
                isUnique: schemaColumn.isUnique,
            };

            leftOperandValue = column;
        } else leftOperandValue = ast.whereCondition.leftOperand;

        filteredTable = this.tableManager.whereEvaluate(
            table,
            ast.whereCondition.operator,
            rightOperandValue,
            leftOperandValue,
        );

        await this.tableManager.deleteRecords(
            ast.tableName,
            filteredTable.rows,
        );
    }

    private async executeSelect(ast: SelectAST): Promise<void> {
        for (const fromClause of ast.from) {
            const isTableExists = await this.tableManager.isTableExists(
                fromClause.tableName,
            );

            if (!isTableExists) {
                throw new ExecutionErrorException(
                    `Table '${fromClause.tableName}' does not exist. Cannot perform select operation.`,
                );
            }

            fromClause.columns = (
                await this.tableManager.getTableSchema(fromClause.tableName)
            ).columnsName;
        }

        if (ast.selectColumns !== '*' && ast.selectColumns.length === 0) {
            throw new ExecutionErrorException(
                `No columns specified for selection in SELECT statement.`,
            );
        }

        if (ast.selectColumns !== '*' && ast.selectColumns.length > 0) {
            for (const selectColumn of ast.selectColumns) {
                const table = ast.from.find(
                    (fromClause) =>
                        fromClause.alias === selectColumn.from ||
                        fromClause.tableName === selectColumn.from,
                );

                if (!table) {
                    throw new ExecutionErrorException(
                        `Table alias '${selectColumn.from}' does not exist in the FROM clause.`,
                    );
                }

                if (table.columns?.includes(selectColumn.name)) {
                    selectColumn.tableName = table.tableName;
                } else {
                    throw new ExecutionErrorException(
                        `Column '${selectColumn.name}' does not exist in table '${table.tableName}'.`,
                    );
                }
            }
        }

        if (ast.whereClause.rightOperand) {
            const rightOperandTable = ast.from.find(
                (fromClause) =>
                    fromClause.alias === ast.whereClause.rightColumnRef ||
                    fromClause.tableName === ast.whereClause.rightColumnRef,
            );

            if (ast.whereClause.isRightOperandColumn && !rightOperandTable) {
                throw new ExecutionErrorException(
                    `Table alias '${ast.whereClause.rightColumnRef}' does not exist in the FROM clause.`,
                );
            }

            if (
                ast.whereClause.isRightOperandColumn &&
                !rightOperandTable?.columns?.includes(
                    ast.whereClause.rightOperand as string,
                )
            ) {
                throw new ExecutionErrorException(
                    `Column '${ast.whereClause.rightOperand}' does not exist in table '${rightOperandTable?.tableName}'.`,
                );
            }
        }

        if (ast.whereClause.leftOperand) {
            const leftOperandTable = ast.from.find(
                (fromClause) =>
                    fromClause.alias === ast.whereClause.leftColumnRef ||
                    fromClause.tableName === ast.whereClause.leftColumnRef,
            );

            if (ast.whereClause.isLeftOperandColumn && !leftOperandTable) {
                throw new ExecutionErrorException(
                    `Table alias '${ast.whereClause.leftColumnRef}' does not exist in the FROM clause.`,
                );
            }

            if (
                ast.whereClause.isLeftOperandColumn &&
                !leftOperandTable?.columns?.includes(
                    ast.whereClause.leftOperand as string,
                )
            ) {
                throw new ExecutionErrorException(
                    `Column '${ast.whereClause.leftOperand}' does not exist in table '${leftOperandTable?.tableName}'.`,
                );
            }
        }

        if (ast.orderByClause && ast.selectColumns !== '*') {
            const orderByColumn = (ast.selectColumns as SelectClause[]).find(
                (selectColumn) =>
                    selectColumn.name === ast.orderByClause!.column.name ||
                    selectColumn.as === ast.orderByClause!.column.name,
            );

            if (!orderByColumn) {
                throw new ExecutionErrorException(
                    `Column '${ast.orderByClause.column.name}' specified in ORDER BY clause does not exist in the SELECT columns.`,
                );
            }
        }

        if (ast.orderByClause && ast.selectColumns === '*') {
            const orderByColumnExists = ast.from.some((fromClause) =>
                fromClause.columns?.includes(ast.orderByClause!.column.name),
            );

            if (!orderByColumnExists) {
                throw new ExecutionErrorException(
                    `Column '${ast.orderByClause.column.name}' specified in ORDER BY clause does not exist in the selected tables.`,
                );
            }
        }

        if (ast.limit !== null && ast.limit < 0) {
            throw new ExecutionErrorException(
                `LIMIT value cannot be negative. Received: ${ast.limit}`,
            );
        }

        const tables: { table: Table; alias: string }[] = [];

        for (const fromClause of ast.from) {
            let table = await this.tableManager.scanTable(fromClause.tableName);
            if (
                (ast.whereClause.rightColumnRef &&
                    (ast.whereClause.rightColumnRef === fromClause.alias ||
                        ast.whereClause.rightColumnRef ===
                            fromClause.tableName)) ||
                (ast.whereClause.leftColumnRef &&
                    (ast.whereClause.leftColumnRef === fromClause.alias ||
                        ast.whereClause.leftColumnRef === fromClause.tableName))
            ) {
                table = this.tableManager.whereEvaluate(
                    table,
                    ast.whereClause.operator,
                    ast.whereClause.rightOperand,
                    ast.whereClause.leftOperand,
                );
            }

            tables.push({
                table,
                alias: fromClause.alias || fromClause.tableName,
            });
        }

        // Implement the logic to fetch and display the selected data
        // This may involve joining tables, applying where conditions, ordering, and limiting results
        // For now, we will just log a message indicating that the SELECT operation was executed
        console.log(`SELECT operation executed successfully.`);
    }
}
