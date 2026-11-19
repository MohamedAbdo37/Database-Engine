import { Injectable } from '@nestjs/common';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { Validator, ValidatorIF } from '../validator.js';
import { UpdateAST } from '../../parser/ast/dml/update.ast.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';
import { Catalog } from '../../../storage/dto/catalog.dto.js';
import { Column } from '../../../storage/table-manager/table.dto.js';
import { Datatype } from '../../../storage/dto/datatype.dto.js';
import { WhereCondition } from '../../parser/ast/dml/dml.class.js';

@Injectable()
export class UpdateValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}

    public async validate(ast: UpdateAST): Promise<void> {
        await Validator.validateIsTableExists(ast.tableName, this.tableManager);

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
            ast.whereCondition.leftOperand =
                WhereCondition.validateWhereOperandAsColumn(
                    ast.whereCondition.leftOperand,
                    schema,
                );

        if (ast.whereCondition.isRightOperandColumn)
            ast.whereCondition.rightOperand =
                WhereCondition.validateWhereOperandAsColumn(
                    ast.whereCondition.rightOperand,
                    schema,
                );
    }
}
