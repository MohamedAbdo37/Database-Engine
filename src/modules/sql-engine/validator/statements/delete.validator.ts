import { Injectable } from '@nestjs/common';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { Validator, ValidatorIF } from '../validator.js';
import { DeleteAST } from '../../parser/ast/dml/delete.ast.js';
import { WhereClauseAST } from '../../parser/ast/dml/where-clause.ast.js';

@Injectable()
export class DeleteValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}

    public async validate(ast: DeleteAST): Promise<void> {
        await Validator.validateIsTableExists(ast.tableName, this.tableManager);

        if (!ast.whereCondition) {
            return;
        }

        const schema = await this.tableManager.getTableSchema(ast.tableName);

        if (!schema) {
            throw new Error(
                `Schema for table ${ast.tableName} not found. Cannot validate delete operation.`,
            );
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
