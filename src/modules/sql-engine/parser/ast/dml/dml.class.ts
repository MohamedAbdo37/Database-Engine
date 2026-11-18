import { WhereOperator } from '../../../../storage/table-manager/table-manager.js';
import { Column } from '../../../../storage/table-manager/table.dto.js';
import { DMLType, MainClassAST } from '../ast.class.js';

export abstract class DML extends MainClassAST {
    tableName: string;
    constructor(type: DMLType) {
        super(type);
    }
}

export interface WhereCondition {
    leftOperand: string | number | null;
    isLeftOperandColumn: boolean;
    operator: WhereOperator;
    rightOperand: string | number | null | Column;
    isRightOperandColumn: boolean;
}
