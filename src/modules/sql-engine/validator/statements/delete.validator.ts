import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { MainClassAST } from '../../parser/ast/ast.class.js';
import { ValidatorIF } from '../validator.js';

export class DeleteValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}

    validate(ast: MainClassAST): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
