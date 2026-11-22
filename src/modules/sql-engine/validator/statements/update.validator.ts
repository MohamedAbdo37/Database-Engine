import { Injectable } from '@nestjs/common';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { Validator, ValidatorIF } from '../validator.js';
import { UpdateAST } from '../../parser/ast/dml/update.ast.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';
import { DatatypeEnum } from '../../../storage/dto/datatype.dto.js';
import { WhereClauseAST } from '../../parser/ast/dml/where-clause.ast.js';

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

            if (
                !columnAssignment.isNull &&
                (schemaColumn.datatype === DatatypeEnum.INT ||
                    schemaColumn.datatype === DatatypeEnum.SERIAL ||
                    schemaColumn.datatype === DatatypeEnum.DOUBLE) &&
                typeof columnAssignment.value !== 'number'
            ) {
                throw new ExecutionErrorException(
                    `Invalid value for column '${columnAssignment.column}' in table '${ast.tableName}'.`,
                );
            }

            if (
                !columnAssignment.isNull &&
                (schemaColumn.datatype === DatatypeEnum.VARCHAR ||
                    schemaColumn.datatype === DatatypeEnum.CHAR) &&
                typeof columnAssignment.value === 'string' &&
                schemaColumn.value >= 0 &&
                columnAssignment.value.length > schemaColumn.value
            ) {
                throw new ExecutionErrorException(
                    `Value for column '${columnAssignment.column}' exceeds the defined length ${schemaColumn.value}.`,
                );
            }
        }

        if (ast.whereCondition.isLeftOperandColumn)
            ast.whereCondition.leftOperand =
                WhereClauseAST.validateWhereOperandAsColumn(
                    ast.whereCondition.leftOperand,
                    schema,
                );

        if (ast.whereCondition.isRightOperandColumn)
            ast.whereCondition.rightOperand =
                WhereClauseAST.validateWhereOperandAsColumn(
                    ast.whereCondition.rightOperand,
                    schema,
                );
    }
}
