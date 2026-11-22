import { DatatypeEnum } from '../../../../storage/dto/datatype.dto.js';
import { SubClassAST } from '../ast.class.js';

export enum ColumnConstraintEnum {
    NOT_NULLABLE = 'NOT_NULL',
    NULLABLE = 'NULL',
    UNIQUE = 'UNIQUE',
    PRIMARY_KEY = 'PRIMARY_KEY',
}

export class ColumnDefinition extends SubClassAST {
    name: string;
    datatype: DatatypeEnum;
    constraints: ColumnConstraintEnum[] = [];
    length?: number;
    defaultValue?: any;

    constructor() {
        super();
    }
}
