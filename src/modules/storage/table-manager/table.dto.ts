import { ExecutionErrorException } from '../../sql-engine/exceptions/execution-error.exc.js';
import { Datatype } from '../dto/datatype.dto.js';
import { RID } from '../dto/rid.dto.js';

export interface Column {
    name: string;
    datatype: Datatype<any>;
    id: number;
    isPrimary: boolean;
    isUnique: boolean;
}

export interface Row {
    rid: RID;
    data: Datatype<any>[];
}

export class Table {
    private _name: string;
    private _columns: Column[];
    private _data: Row[];

    constructor(name: string, columns: Column[]) {
        this._name = name;
        this._columns = columns;
        this._data = [];
    }

    public get rows(): Row[] {
        return this._data;
    }

    public get name(): string {
        return this._name;
    }

    public get primaryKeyColumn(): Column | undefined {
        return this._columns.find((column) => column.isPrimary);
    }

    public get columns(): Column[] {
        return this._columns;
    }

    public get size(): { rows: number; columns: number } {
        return { rows: this._data.length, columns: this._columns.length };
    }

    public getRowByRID(rid: RID): Row | undefined {
        return this._data.find(
            (row) =>
                row.rid.pageId === rid.pageId &&
                row.rid.slotNumber === rid.slotNumber,
        );
    }

    public getRowByIndex(index: number): Row | undefined {
        if (index < 0 || index >= this._data.length) {
            throw new Error(`Index ${index} is out of bounds.`);
        }
        return this._data[index];
    }

    public getRowByPrimaryKeyValue(value: any): Row | undefined {
        const primaryKeyColumn = this.primaryKeyColumn;
        if (!primaryKeyColumn) {
            throw new Error('No primary key column defined for this table.');
        }

        return this._data.find(
            (row) => row.data[primaryKeyColumn.id].value === value,
        );
    }

    public getRowByColumnValue(
        columnName: string,
        value: any,
    ): Row | undefined {
        const column = this._columns.find((col) => col.name === columnName);
        if (!column) {
            throw new Error(
                `Column ${columnName} does not exist in the table.`,
            );
        }
        return this._data.find((row) => row.data[column.id].value === value);
    }

    public getColumnIndexByName(columnName: string): number {
        const column = this._columns.find((col) => col.name === columnName);
        if (!column) {
            throw new Error(
                `Column ${columnName} does not exist in the table.`,
            );
        }
        return column.id;
    }

    public getColumns(columnNames?: string[]): Table {
        if (!columnNames) {
            return this;
        }

        for (const name of columnNames) {
            const column = this._columns.find((col) => col.name === name);
            if (!column) {
                throw new Error(`Column ${name} does not exist in the table.`);
            }
        }

        const selectedColumns: Column[] = columnNames.map((name) => {
            const column = this._columns.find((col) => col.name === name);
            if (!column) {
                throw new Error(`Column ${name} does not exist in the table.`);
            }
            return column;
        });

        const newTable = new Table(this._name, selectedColumns);

        const rows: Row[] = this._data.map((row) => {
            const newRowData: Datatype<any>[] = selectedColumns.map(
                (col) => row.data[col.id],
            );
            return { rid: row.rid, data: newRowData };
        });

        newTable.addMultipleRowsToTableView(rows);

        return newTable;
    }

    public addRowToTableView(rid: RID, data: Datatype<any>[]): void {
        if (data.length !== this._columns.length) {
            throw new Error(
                `Data length (${data.length}) does not match number of columns (${this._columns.length})`,
            );
        }

        const primaryKeyColumn = this.primaryKeyColumn;

        this._data.push({ rid, data });

        if (primaryKeyColumn) {
            this._data.sort((a, b) => {
                const aValue = a.data[primaryKeyColumn.id].value;
                const bValue = b.data[primaryKeyColumn.id].value;
                if (aValue < bValue) return -1;
                if (aValue > bValue) return 1;
                return 0;
            });
        }
    }

    public addMultipleRowsToTableView(rows: Row[]): void {
        this._data.push(...rows);

        const primaryKeyColumn = this.primaryKeyColumn;

        if (primaryKeyColumn) {
            this._data.sort((a, b) => {
                const aValue = a.data[primaryKeyColumn.id].value;
                const bValue = b.data[primaryKeyColumn.id].value;
                if (aValue < bValue) return -1;
                if (aValue > bValue) return 1;
                return 0;
            });
        }
    }

    public renameColumns(newNames: string[]): Table {
        if (newNames.length !== this._columns.length) {
            throw new ExecutionErrorException(
                `New names length (${newNames.length}) does not match number of columns (${this._columns.length})`,
            );
        }

        this._columns.forEach((column, index) => {
            if (newNames[index]) {
                column.name = newNames[index];
            }
        });

        return this;
    }

    public sortRowsByColumn(
        columnName: string,
        ascending: boolean = true,
    ): void {
        const column = this._columns.find((col) => col.name === columnName);
        if (!column) {
            throw new Error(
                `Column ${columnName} does not exist in the table.`,
            );
        }

        this._data.sort((a, b) => {
            const aValue = a.data[column.id].value;
            const bValue = b.data[column.id].value;
            if (aValue < bValue) return ascending ? -1 : 1;
            if (aValue > bValue) return ascending ? 1 : -1;
            return 0;
        });
    }

    public getFirstNRows(n: number): Table {
        if (n < 0) {
            throw new Error(
                `Number of rows to retrieve (${n}) cannot be negative.`,
            );
        }

        this._data = this._data.slice(0, n);
        return this;
    }

    public static mapTableToRows<
        T extends Record<string, unknown> = Record<string, unknown>,
    >(table: Table, extraFields?: Partial<T>): T[] {
        return table._data.map((row) => {
            const mappedRow: Record<string, unknown> = {};

            table._columns.forEach((col, index) => {
                const cell = row.data[index];
                mappedRow[col.name] = cell?.isNull
                    ? null
                    : (cell?.value ?? null);
            });

            return {
                ...mappedRow,
                ...extraFields,
            } as T;
        });
    }
}
