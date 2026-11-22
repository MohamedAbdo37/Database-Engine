import { Injectable } from '@nestjs/common';
import { ExecutorIF } from '../executor.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { DeleteAST } from '../../parser/ast/dml/delete.ast.js';
import { Column, Table } from '../../../storage/table-manager/table.dto.js';

@Injectable()
export class DeleteExecutor implements ExecutorIF {
    constructor(private readonly tableManager: TableManager) {}
    public async execute(ast: DeleteAST): Promise<string> {
        const table: Table = await this.tableManager.scanTable(ast.tableName);

        if (!ast.whereCondition) {
            await this.tableManager.deleteRecords(ast.tableName, table.rows);
            return `Deleted ${table.rows.length} records from table '${ast.tableName}'.`;
        }

        let filteredTable: Table;

        let rightOperandValue: any;
        let leftOperandValue: any;

        if (ast.whereCondition.isRightOperandColumn)
            rightOperandValue = ast.whereCondition.rightOperand as Column;
        else rightOperandValue = ast.whereCondition.rightOperand;

        if (ast.whereCondition.isLeftOperandColumn)
            leftOperandValue = ast.whereCondition.leftOperand as Column;
        else leftOperandValue = ast.whereCondition.leftOperand;

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

        return `Deleted ${filteredTable.rows.length} records from table '${ast.tableName}'.`;
    }
}
