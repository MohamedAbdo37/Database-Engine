import { Catalog } from '../../../../storage/dto/catalog.dto.js';
import { Datatype } from '../../../../storage/dto/datatype.dto.js';
import { WhereOperator } from '../../../../storage/table-manager/table-manager.js';
import { Column } from '../../../../storage/table-manager/table.dto.js';
import { ExecutionErrorException } from '../../../exceptions/execution-error.exc.js';
import { DMLType, MainClassAST } from '../ast.class.js';

export abstract class DML extends MainClassAST {
    tableName: string;
    constructor(type: DMLType) {
        super(type);
    }
}

export class WhereCondition {
    leftOperand: string | number | null | Column;
    isLeftOperandColumn: boolean;
    leftColumnRef?: string;
    operator: WhereOperator;
    rightOperand: string | number | null | Column;
    isRightOperandColumn: boolean;
    rightColumnRef?: string;

    public static validateWhereOperandAsColumn(
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
