import { Injectable } from '@nestjs/common';
import { ExecutorIF } from '../executor.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { UpdateAST } from '../../parser/ast/dml/update.ast.js';
import { Datatype } from '../../../storage/dto/datatype.dto.js';
import { Table, Column } from '../../../storage/table-manager/table.dto.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';

@Injectable()
export class UpdateExecutor implements ExecutorIF {
    constructor(private readonly tableManager: TableManager) {}
    public async execute(ast: UpdateAST): Promise<void> {
        let rightOperandValue: any;
        let leftOperandValue: any;

        const schema = await this.tableManager.getTableSchema(ast.tableName);

        if (ast.whereCondition.isRightOperandColumn) {
            rightOperandValue = ast.whereCondition.rightOperand as Column;
        } else rightOperandValue = ast.whereCondition.rightOperand;

        if (ast.whereCondition.isLeftOperandColumn) {
            leftOperandValue = ast.whereCondition.leftOperand as Column;
        } else leftOperandValue = ast.whereCondition.leftOperand;

        const table: Table = await this.tableManager.scanTable(ast.tableName);

        const filteredTable: Table = this.tableManager.whereEvaluate(
            table,
            ast.whereCondition.operator,
            rightOperandValue,
            leftOperandValue,
        );

        for (const row of filteredTable.rows) {
            for (const columnAssignment of ast.columns) {
                const schemaColumn = schema.getColumnByName(
                    columnAssignment.column,
                );

                try {
                    row.data[schemaColumn!.id] = Datatype.getDatatypeInstance(
                        schemaColumn!.datatype,
                        schemaColumn!.value,
                        columnAssignment.value,
                        columnAssignment.isNull,
                    );
                } catch (error: any) {
                    throw new ExecutionErrorException(
                        `Invalid value for column '${columnAssignment.column}': ${error.message}`,
                    );
                }
            }
        }

        await this.tableManager.updateRecords(
            ast.tableName,
            await this.tableManager.getCatalogSchemaRecord(ast.tableName),
            filteredTable.rows,
        );
    }
}
