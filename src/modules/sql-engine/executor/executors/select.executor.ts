import { Injectable } from '@nestjs/common';
import { ExecutorIF } from '../executor.js';
import { SelectAST } from '../../parser/ast/select.class.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { Table } from '../../../storage/table-manager/table.dto.js';
import { FromClause, OrderDirection } from '../../parser/ast/ast.class.js';

@Injectable()
export class SelectExecutor implements ExecutorIF {
    constructor(private readonly tableManager: TableManager) {}

    private isInHasWhereClause(
        ast: SelectAST,
        fromClause: FromClause,
    ): boolean {
        return Boolean(
            ast.whereClause &&
            ((ast.whereClause.rightColumnRef &&
                (ast.whereClause.rightColumnRef === fromClause.alias ||
                    ast.whereClause.rightColumnRef === fromClause.tableName)) ||
                (ast.whereClause.leftColumnRef &&
                    (ast.whereClause.leftColumnRef === fromClause.alias ||
                        ast.whereClause.leftColumnRef ===
                            fromClause.tableName)))
        );
    }
    public async execute(ast: SelectAST): Promise<Table> {
        const tables: { table: Table; alias: string }[] = [];

        for (const fromClause of ast.from) {
            let table = await this.tableManager.scanTable(fromClause.tableName);
            if (this.isInHasWhereClause(ast, fromClause)) {
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

        // No JOIN logic implemented yet, so we will just return the first table for now
        const resultTable = tables[0].table;

        if (ast.orderByClause) {
            resultTable.sortRowsByColumn(
                ast.orderByClause.column.name,
                ast.orderByClause.direction === OrderDirection.ASC,
            );
        }

        let selectedColumns: string[] = [];
        let columnsNewNames: string[] | undefined;

        if (ast.selectColumns !== '*') {
            columnsNewNames = [];
            for (const selectClause of ast.selectColumns) {
                selectedColumns.push(selectClause.name);
                if (selectClause.as) columnsNewNames.push(selectClause.as);
                else if (selectClause.from)
                    columnsNewNames.push(
                        `${selectClause.from}.${selectClause.name}`,
                    );
                else columnsNewNames.push(selectClause.name);
            }
        } else selectedColumns = resultTable.columns.map((col) => col.name);

        const finalTable = resultTable
            .getColumns(selectedColumns)
            .renameColumns(columnsNewNames ?? selectedColumns);

        if (ast.limit) {
            finalTable.getFirstNRows(ast.limit);
        }

        return finalTable;
    }
}
