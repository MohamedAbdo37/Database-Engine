import { Injectable } from '@nestjs/common';
import { MainClassAST } from '../../parser/ast/ast.class.js';
import { ValidatorIF } from '../validator.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';

@Injectable()
export class InsertValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}

    validate(ast: MainClassAST): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
