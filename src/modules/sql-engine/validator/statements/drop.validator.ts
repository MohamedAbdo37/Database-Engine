import { Injectable } from '@nestjs/common';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { MainClassAST } from '../../parser/ast/ast.class.js';
import { ValidatorIF } from '../validator.js';

@Injectable()
export class DropValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}
    public async validate(ast: MainClassAST): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
