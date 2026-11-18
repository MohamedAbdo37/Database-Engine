import { vi } from 'vitest';
import { Validator } from './validator.js';
import { CreateValidator } from './statements/create.validator.js';
import { DropValidator } from './statements/drop.validator.js';
import { AlterValidator } from './statements/alter.validator.js';
import { InsertValidator } from './statements/insert.validator.js';
import { UpdateValidator } from './statements/update.validator.js';
import { DeleteValidator } from './statements/delete.validator.js';
import { SelectValidator } from './statements/select.validator.js';

describe('Validator', () => {
    it('should be defined', () => {
        const createValidator = {
            validate: vi.fn(),
        } as unknown as CreateValidator;

        const dropValidator = {
            validate: vi.fn(),
        } as unknown as DropValidator;

        const alterValidator = {
            validate: vi.fn(),
        } as unknown as AlterValidator;

        const insertValidator = {
            validate: vi.fn(),
        } as unknown as InsertValidator;

        const updateValidator = {
            validate: vi.fn(),
        } as unknown as UpdateValidator;

        const deleteValidator = {
            validate: vi.fn(),
        } as unknown as DeleteValidator;

        const selectValidator = {
            validate: vi.fn(),
        } as unknown as SelectValidator;

        expect(
            new Validator(
                createValidator,
                dropValidator,
                alterValidator,
                insertValidator,
                selectValidator,
                updateValidator,
                deleteValidator,
            ),
        ).toBeDefined();
    });
});
