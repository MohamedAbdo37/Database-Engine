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
import { CreateTableAST } from '../parser/ast/ddl/create-table.ast.js';
import { ColumnConstraintEnum } from '../parser/ast/ddl/column-definition.ast.js';
import { DropTableAST } from '../parser/ast/ddl/drop-table.ast.js';
import { UpdateAST } from '../parser/ast/dml/update.ast.js';
import { SelectAST } from '../parser/ast/select.class.js';

const mockTableCatalog = [
    new CatalogColumn('id', 0, DatatypeEnum.INT, true, true, false, 0),
    new CatalogColumn('name', 1, DatatypeEnum.VARCHAR, false, false, false, 50),
];

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

    it('rejects a null value for a non-nullable column', async () => {
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
            updateCatalog: vi.fn(),
        } as unknown as TableManager;

        const validator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'users',
            rows: [
                {
                    columns: [{ name: 'name', value: null, isNullable: true }],
                },
            ],
        } as InsertAST;

        await expect(validator.validate(ast)).rejects.toThrow(
            "Column 'name' cannot be null in table 'users'.",
        );
    });

    it('rejects a duplicate column in the same row', async () => {
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
            updateCatalog: vi.fn(),
        } as unknown as TableManager;

        const validator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'users',
            rows: [
                {
                    columns: [
                        { name: 'name', value: 'Alice', isNullable: false },
                        { name: 'name', value: 'Bob', isNullable: false },
                    ],
                },
            ],
        } as InsertAST;

        await expect(validator.validate(ast)).rejects.toThrow(
            "Column 'name' is provided more than once in the INSERT statement.",
        );
    });

    it('rejects a missing non-nullable column', async () => {
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
            updateCatalog: vi.fn(),
        } as unknown as TableManager;

        const validator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'users',
            rows: [
                {
                    columns: [],
                },
            ],
        } as unknown as InsertAST;

        await expect(validator.validate(ast)).rejects.toThrow(
            "Column 'name' is required in table 'users' and cannot be null.",
        );
    });

    it('should throw an error if the table does not exist', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;

        const insertValidator = new InsertValidator(tableManager);
        const ast = {
            tableName: 'non_existent_table',
            rows: [],
        } as unknown as InsertAST;

        await expect(insertValidator.validate(ast)).rejects.toThrow(
            "Table 'non_existent_table' does not exist",
        );
    });
});

describe('CreateValidator', () => {
    it('should call tableManager.isTableExists and throw error if table exists', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
        } as unknown as TableManager;
        const createValidator = new CreateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [
                {
                    name: 'id',
                    datatype: DatatypeEnum.INT,
                    constraints: [],
                },
            ],
        } as unknown as CreateTableAST;

        await expect(createValidator.validate(ast)).rejects.toThrow(
            "Table 'test_table' already exists",
        );
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should call tableManager.isTableExists and not throw error if table does not exist', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const createValidator = new CreateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [
                {
                    name: 'id',
                    datatype: DatatypeEnum.INT,
                    constraints: [],
                },
            ],
        } as unknown as CreateTableAST;

        await expect(createValidator.validate(ast)).resolves.not.toThrow();
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should throw error if no columns are defined', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const createValidator = new CreateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [],
        } as unknown as CreateTableAST;

        await expect(createValidator.validate(ast)).rejects.toThrow(
            "Table 'test_table' must have at least one column defined",
        );
    });

    it('should throw error if multiple primary keys are defined', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const createValidator = new CreateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [
                {
                    name: 'id',
                    datatype: DatatypeEnum.INT,
                    constraints: [ColumnConstraintEnum.PRIMARY_KEY],
                },
                {
                    name: 'name',
                    datatype: DatatypeEnum.VARCHAR,
                    constraints: [ColumnConstraintEnum.PRIMARY_KEY],
                },
            ],
        } as unknown as CreateTableAST;

        await expect(createValidator.validate(ast)).rejects.toThrow(
            "Table 'test_table' cannot have multiple primary keys defined",
        );
    });

    it('should throw error if a column is defined as both primary and nullable', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const createValidator = new CreateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [
                {
                    name: 'id',
                    datatype: DatatypeEnum.INT,
                    constraints: [
                        ColumnConstraintEnum.PRIMARY_KEY,
                        ColumnConstraintEnum.NULLABLE,
                    ],
                },
            ],
        } as unknown as CreateTableAST;

        await expect(createValidator.validate(ast)).rejects.toThrow(
            "Column 'id' cannot be both primary and nullable",
        );
    });

    it('should not throw error if table does not exist and columns are valid', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const createValidator = new CreateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [
                {
                    name: 'id',
                    datatype: DatatypeEnum.INT,
                    constraints: [ColumnConstraintEnum.PRIMARY_KEY],
                },
                {
                    name: 'name',
                    datatype: DatatypeEnum.VARCHAR,
                    constraints: [ColumnConstraintEnum.NULLABLE],
                },
            ],
        } as unknown as CreateTableAST;

        await expect(createValidator.validate(ast)).resolves.not.toThrow();
    });
});

describe('DropValidator', () => {
    it('should call tableManager.isTableExists and throw error if table does not exist', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const dropValidator = new DropValidator(tableManager);
        const ast = {
            tableName: 'test_table',
        } as unknown as DropTableAST;

        await expect(dropValidator.validate(ast)).rejects.toThrow(
            "Table 'test_table' does not exist",
        );
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should call tableManager.isTableExists and not throw error if table exists', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
        } as unknown as TableManager;
        const dropValidator = new DropValidator(tableManager);
        const ast = {
            tableName: 'test_table',
        } as unknown as DropTableAST;

        await expect(dropValidator.validate(ast)).resolves.not.toThrow();
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });
});

describe('updateValidator', () => {
    it('should call tableManager.isTableExists and throw error if table does not exist', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const updateValidator = new UpdateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
        } as unknown as any; // Replace with actual UpdateAST type

        await expect(updateValidator.validate(ast)).rejects.toThrow(
            "Table 'test_table' does not exist",
        );
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should call tableManager.isTableExists and not throw error if table exists', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi
                .fn()
                .mockResolvedValue(new Catalog('test_table', mockTableCatalog)),
        } as unknown as TableManager;
        const updateValidator = new UpdateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [{ column: 'id', value: 42, isNull: false }],
            whereCondition: {
                leftOperand: 'id',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as UpdateAST;

        await expect(updateValidator.validate(ast)).resolves.not.toThrow();
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should throw error if a column in the SET clause does not exist', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const updateValidator = new UpdateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [
                { column: 'non_existing_column', value: 42, isNull: false },
            ],
            whereCondition: {
                leftOperand: 'existing_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as UpdateAST;

        await expect(updateValidator.validate(ast)).rejects.toThrow(
            "Column 'non_existing_column' does not exist in table 'test_table'.",
        );
    });

    it('should throw error if a column in the SET clause is not nullable and value is null', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'non_nullable_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const updateValidator = new UpdateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [
                { column: 'non_nullable_column', value: null, isNull: true },
            ],
            whereCondition: {
                leftOperand: 'non_nullable_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as UpdateAST;

        await expect(updateValidator.validate(ast)).rejects.toThrow(
            "Column 'non_nullable_column' cannot be null in table 'test_table'.",
        );
    });

    it('should throw error if a column in the WHERE clause does not exist', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const updateValidator = new UpdateValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            columns: [{ column: 'existing_column', value: 42, isNull: false }],
            whereCondition: {
                leftOperand: 'undefined',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as UpdateAST;

        await expect(updateValidator.validate(ast)).rejects.toThrow(
            "Column 'undefined' does not exist in table 'test_table'.",
        );
    });
});

describe('DeleteValidator', () => {
    it('should call tableManager.isTableExists and throw error if table does not exist', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const deleteValidator = new DeleteValidator(tableManager);
        const ast = {
            tableName: 'test_table',
        } as unknown as any; // Replace with actual DeleteAST type

        await expect(deleteValidator.validate(ast)).rejects.toThrow(
            "Table 'test_table' does not exist",
        );
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should call tableManager.isTableExists and not throw error if table exists', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
        } as unknown as TableManager;
        const deleteValidator = new DeleteValidator(tableManager);
        const ast = {
            tableName: 'test_table',
        } as unknown as any; // Replace with actual DeleteAST type

        await expect(deleteValidator.validate(ast)).resolves.not.toThrow();
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should throw error if a column in the WHERE clause does not exist', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const deleteValidator = new DeleteValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            whereCondition: {
                leftOperand: 'undefined',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as any; // Replace with actual DeleteAST type

        await expect(deleteValidator.validate(ast)).rejects.toThrow(
            "Column 'undefined' does not exist in table 'test_table'.",
        );
    });

    it('should not throw error if table exists and columns are valid', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const deleteValidator = new DeleteValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            whereCondition: {
                leftOperand: 'existing_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as any; // Replace with actual DeleteAST type

        await expect(deleteValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if table exists and no WHERE clause is provided', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const deleteValidator = new DeleteValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            whereCondition: null,
        } as unknown as any; // Replace with actual DeleteAST type

        await expect(deleteValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if table does exist and no WHERE clause is provided', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const deleteValidator = new DeleteValidator(tableManager);
        const ast = {
            tableName: 'test_table',
            whereCondition: null,
        } as unknown as any; // Replace with actual DeleteAST type

        await expect(deleteValidator.validate(ast)).resolves.not.toThrow();
    });
});

describe('SelectValidator', () => {
    it('should call tableManager.isTableExists and throw error if table does not exist', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(false),
        } as unknown as TableManager;
        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Table 'test_table' does not exist",
        );
        expect(tableManager.isTableExists).toHaveBeenCalledWith('test_table');
    });

    it('should call tableManager.isTableExists and not throw error if table exists', async () => {
        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi
                .fn()
                .mockResolvedValue(new Catalog('test_table', mockTableCatalog)),
        } as unknown as TableManager;
        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'id' }],
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if a column in the SELECT clause does not exist', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'non_existing_column' }],
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Column 'non_existing_column' does not exist in table 'test_table'.",
        );
    });

    it('should throw error if a column in the WHERE clause does not exist', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: {
                leftOperand: 'non_existing_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Column 'non_existing_column' does not exist in table 'test_table'.",
        );
    });

    it('should not throw error if table exists and columns are valid', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: {
                leftOperand: 'existing_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if table exists and no WHERE clause is provided', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);

        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: null,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if table exists and no SELECT columns are provided', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);

        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [],
            whereClause: null,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            'No columns specified for selection in SELECT statement.',
        );
    });

    it('should not throw error if table exists and SELECT columns are *', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: null,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if LIMIT value is negative', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: null,
            limit: -5,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            'LIMIT value cannot be negative. Received: -5',
        );
    });

    it('should not throw error if LIMIT value is positive', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: null,
            limit: 10,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if LIMIT value is zero', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: null,
            limit: 0,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if ORDER BY column does not exist in the table', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: null,
            orderByClause: {
                column: { name: 'non_existing_column' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Column 'non_existing_column' does not exist in table 'test_table'.",
        );
    });

    it('should not throw error if ORDER BY column exists in the table', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: null,
            orderByClause: {
                column: { name: 'existing_column' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if an alias in SELECT not exist in FROM tables', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table', alias: 't' }],
            selectColumns: [
                { name: 'existing_column', from: 'non_existing_alias' },
            ],
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Table alias 'non_existing_alias' does not exist in the FROM clause.",
        );
    });

    it('should not throw error if an alias in SELECT exist in FROM tables', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table', alias: 't' }],
            selectColumns: [{ name: 'existing_column', from: 't' }],
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if an alias in SELECT exist in FROM tables without alias', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column', from: 'test_table' }],
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if an alias in SELECT not exist in FROM tables without alias', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [
                { name: 'existing_column', from: 'non_existing_alias' },
            ],
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Table alias 'non_existing_alias' does not exist in the FROM clause.",
        );
    });

    it('should throw error if an alias in ORDER BY not exist in FROM tables', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;
        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table', alias: 't' }],
            selectColumns: [{ name: 'existing_column', from: 't' }],
            orderByClause: {
                column: { name: 'existing_column', from: 'non_existing_alias' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Table alias 'non_existing_alias' does not exist in the FROM clause.",
        );
    });

    it('should not throw error if an alias in ORDER BY exist in FROM tables', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table', alias: 't' }],
            selectColumns: [{ name: 'existing_column', from: 't' }],
            orderByClause: {
                column: { name: 'existing_column', from: 't' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if an alias in ORDER BY exist in FROM tables without alias', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column', from: 'test_table' }],
            orderByClause: {
                column: { name: 'existing_column', from: 'test_table' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if an alias in ORDER BY not exist in FROM tables without alias', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column', from: 'test_table' }],
            orderByClause: {
                column: { name: 'existing_column', from: 'non_existing_alias' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Table alias 'non_existing_alias' does not exist in the FROM clause.",
        );
    });

    it('should not throw error if table exists and no ORDER BY clause is provided', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column' }],
            whereClause: null,
            orderByClause: null,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if table exists and no SELECT columns are provided but SELECT * is used', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: null,
            orderByClause: null,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if table exists and no SELECT columns are provided but SELECT * is used with ORDER BY', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: null,
            orderByClause: {
                column: { name: 'existing_column', from: 'test_table' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if table exists and no SELECT columns are provided but SELECT * is used with ORDER BY on non-existing column', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: null,
            orderByClause: {
                column: { name: 'non_existing_column', from: 'test_table' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Column 'non_existing_column' does not exist in table 'test_table'.",
        );
    });

    it('should throw error if alias in Where clause does not exist in FROM tables', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table', alias: 't' }],
            selectColumns: [{ name: 'existing_column', from: 't' }],
            whereClause: {
                leftOperand: 'existing_column',
                leftColumnRef: 'non_existing_table',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Table 'non_existing_table' does not exist in the FROM clause.",
        );
    });

    it('should not throw error if alias in Where clause exists in FROM tables', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table', alias: 't' }],
            selectColumns: [{ name: 'existing_column', from: 't' }],
            whereClause: {
                leftOperand: 'existing_column',
                leftColumnRef: 't',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if alias in Where clause exists in FROM tables without alias', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column', from: 'test_table' }],
            whereClause: {
                leftOperand: 'existing_column',
                leftColumnRef: 'test_table',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should throw error if alias in Where clause does not exist in FROM tables without alias', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: [{ name: 'existing_column', from: 'test_table' }],
            whereClause: {
                leftOperand: 'existing_column',
                leftColumnRef: 'non_existing_table',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).rejects.toThrow(
            "Table 'non_existing_table' does not exist in the FROM clause.",
        );
    });

    it('should not throw error if table exists and no SELECT columns are provided but SELECT * is used with WHERE clause', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: {
                leftOperand: 'existing_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw error if table exists and no SELECT columns are provided but SELECT * is used with WHERE clause and ORDER BY clause', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: {
                leftOperand: 'existing_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
                operator: '=',
            },
            orderByClause: {
                column: { name: 'existing_column', from: 'test_table' },
                direction: 'ASC',
            },
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw an error if table exists and no SELECT columns are provided but SELECT * is used LIMIT 1', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: null,
            orderByClause: null,
            limit: 1,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });

    it('should not throw an error if table exists and no SELECT columns are provided but SELECT * is used and Where, OrderBy clause and LIMIT 1 are provided', async () => {
        const catalog = new Catalog('test_table', [
            new CatalogColumn(
                'existing_column',
                0,
                DatatypeEnum.INT,
                false,
                false,
                false,
                0,
            ),
        ]);

        const tableManager = {
            isTableExists: vi.fn().mockResolvedValue(true),
            getTableSchema: vi.fn().mockResolvedValue(catalog),
        } as unknown as TableManager;

        const selectValidator = new SelectValidator(tableManager);
        const ast = {
            from: [{ tableName: 'test_table' }],
            selectColumns: '*',
            whereClause: {
                leftOperand: 'existing_column',
                isLeftOperandColumn: true,
                rightOperand: 1,
                isRightOperandColumn: false,
                operator: '=',
            },
            orderByClause: {
                column: { name: 'existing_column', from: 'test_table' },
                direction: 'ASC',
            },
            limit: 1,
        } as unknown as SelectAST;

        await expect(selectValidator.validate(ast)).resolves.not.toThrow();
    });
});
