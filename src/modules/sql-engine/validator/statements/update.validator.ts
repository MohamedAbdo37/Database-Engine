import { Injectable } from '@nestjs/common';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { Validator, ValidatorIF } from '../validator.js';
import { UpdateAST } from '../../parser/ast/dml/update.ast.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';
import { Catalog } from '../../../storage/dto/catalog.dto.js';
import { Column } from '../../../storage/table-manager/table.dto.js';
import { Datatype } from '../../../storage/dto/datatype.dto.js';

@Injectable()
export class UpdateValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}

    public async validate(ast: UpdateAST): Promise<void> {
        Validator.validateIsTableExists(ast.tableName, this.tableManager);

        const schema = await this.tableManager.getTableSchema(ast.tableName);

        if (!schema) {
            throw new ExecutionErrorException(
                `Schema for table ${ast.tableName} not found.`,
            );
        }

        for (const columnAssignment of ast.columns) {
            const schemaColumn = schema.getColumnByName(
                columnAssignment.column,
            );

            if (!schemaColumn) {
                throw new ExecutionErrorException(
                    `Column '${columnAssignment.column}' does not exist in table '${ast.tableName}'.`,
                );
            }

            if (columnAssignment.isNull && !schemaColumn.isNullable) {
                throw new ExecutionErrorException(
                    `Column '${columnAssignment.column}' cannot be null in table '${ast.tableName}'.`,
                );
            }
        }

        if (ast.whereCondition.isLeftOperandColumn)
            ast.whereCondition.leftOperand = this.validateWhereOperandAsColumn(
                ast.whereCondition.leftOperand,
                schema,
            );

        if (ast.whereCondition.isRightOperandColumn)
            ast.whereCondition.rightOperand = this.validateWhereOperandAsColumn(
                ast.whereCondition.rightOperand,
                schema,
            );
    }

    private validateWhereOperandAsColumn(
        operand: string | number | null | Column,
        schema: Catalog,
    ): Column {
        if (operand === null) {
            throw new ExecutionErrorException(
                'Operand cannot be null when it is expected to be a column name.',
            );
        }

        if (typeof operand !== 'string') {
            throw new ExecutionErrorException(
                `Expected a column name as a string, but got ${typeof operand}.`,
            );
        }

        const column = schema.getColumnByName(operand as string);
        if (!column) {
            throw new ExecutionErrorException(
                `Column ${operand} does not exist in table ${schema.tableName}.`,
            );
        }

        operand = {
            name: column.name,
            datatype: Datatype.getDatatypeInstance(
                column?.datatype,
                column.value,
            ),
            id: column.id,
            isPrimary: column.isPrimary,
            isUnique: column.isUnique,
        };

        return operand;
    }
}
