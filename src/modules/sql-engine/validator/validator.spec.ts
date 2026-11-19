import { vi } from 'vitest';
import { Validator } from './validator.js';
import { CreateValidator } from './statements/create.validator.js';
import { DropValidator } from './statements/drop.validator.js';
import { AlterValidator } from './statements/alter.validator.js';
import { InsertValidator } from './statements/insert.validator.js';
import { UpdateValidator } from './statements/update.validator.js';
import { DeleteValidator } from './statements/delete.validator.js';
import { SelectValidator } from './statements/select.validator.js';
import { InsertAST } from '../parser/ast/dml/insert.ast.js';
import { TableManager } from '../../storage/table-manager/table-manager.js';
import { DatatypeEnum } from '../../storage/dto/datatype.dto.js';
import { Catalog, CatalogColumn } from '../../storage/dto/catalog.dto.js';

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

describe('InsertValidator', () => {
    it('generates and persists SERIAL values for omitted columns', async () => {
        const catalog = new Catalog('users', [
            new CatalogColumn(
                'id',
                0,
                DatatypeEnum.SERIAL,
                true,
                true,
                false,
                0,
            ),
            new CatalogColumn(
                'name',
                1,
                DatatypeEnum.VARCHAR,
                false,
                false,
                false,
                50,
            ),
        ]);
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
            updateCatalog: vi.fn().mockResolvedValue(undefined),
        } as unknown as TableManager;
        const validator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'users',
            rows: [
                {
                    columns: [
                        { name: 'name', value: 'Alice', isNullable: false },
                    ],
                },
                {
                    columns: [
                        { name: 'name', value: 'Bob', isNullable: false },
                    ],
                },
            ],
        } as InsertAST;

        await validator.validate(ast);

        expect(ast.rows[0].columns).toContainEqual({
            name: 'id',
            value: 1,
            isNullable: false,
        });
        expect(ast.rows[1].columns).toContainEqual({
            name: 'id',
            value: 2,
            isNullable: false,
        });
        expect(catalog.columns[0].value).toBe(2);
        expect(tableManager.updateCatalog).toHaveBeenCalledWith(catalog);
    });

    it('rejects an unknown column', async () => {
        const catalog = new Catalog('users', [
            new CatalogColumn(
                'id',
                0,
                DatatypeEnum.SERIAL,
                true,
                true,
                false,
                0,
            ),
        ]);
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
            updateCatalog: vi.fn(),
        } as unknown as TableManager;
        const validator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'users',
            rows: [
                {
                    columns: [{ name: 'unknown', value: 1, isNullable: false }],
                },
            ],
        } as InsertAST;

        await expect(validator.validate(ast)).rejects.toThrow(
            "Column 'unknown' does not exist",
        );
    });
});

describe('InsertValidator', () => {
    it('generates and persists SERIAL values for omitted columns', async () => {
        const catalog = new Catalog('users', [
            new CatalogColumn(
                'id',
                0,
                DatatypeEnum.SERIAL,
                true,
                true,
                false,
                0,
            ),
            new CatalogColumn(
                'name',
                1,
                DatatypeEnum.VARCHAR,
                false,
                false,
                false,
                50,
            ),
        ]);
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
            updateCatalog: vi.fn().mockResolvedValue(undefined),
        } as unknown as TableManager;
        const validator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'users',
            rows: [
                {
                    columns: [
                        { name: 'name', value: 'Alice', isNullable: false },
                    ],
                },
                {
                    columns: [
                        { name: 'name', value: 'Bob', isNullable: false },
                    ],
                },
            ],
        } as InsertAST;

        await validator.validate(ast);

        expect(ast.rows[0].columns).toContainEqual({
            name: 'id',
            value: 1,
            isNullable: false,
        });
        expect(ast.rows[1].columns).toContainEqual({
            name: 'id',
            value: 2,
            isNullable: false,
        });
        expect(catalog.columns[0].value).toBe(2);
        expect(tableManager.updateCatalog).toHaveBeenCalledWith(catalog);
    });

    it('rejects an unknown column', async () => {
        const catalog = new Catalog('users', [
            new CatalogColumn(
                'id',
                0,
                DatatypeEnum.SERIAL,
                true,
                true,
                false,
                0,
            ),
        ]);
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
            updateCatalog: vi.fn(),
        } as unknown as TableManager;
        const validator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'users',
            rows: [
                {
                    columns: [{ name: 'unknown', value: 1, isNullable: false }],
                },
            ],
        } as InsertAST;

        await expect(validator.validate(ast)).rejects.toThrow(
            "Column 'unknown' does not exist",
        );
    });
});
