import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rm } from 'fs/promises';
import { AppModule } from './../src/app.module.js';
import { StandardErrorResponse } from '../src/common/filters/api-exception.filter.js';
import { StandardResponse } from '../src/common/interceptors/api-response.interceptor.js';

function assertSuccess<T>(
    body: unknown,
    expectedStatus = 200,
): asserts body is StandardResponse<T> {
    const res = body as StandardResponse<T>;
    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(expectedStatus);
    expect(typeof res.timestamp).toBe('string');
    expect(res.timestamp.length).toBeGreaterThan(0);
    expect(res.data).toBeDefined();
}

function assertError(
    body: unknown,
    expectedStatus: number,
): asserts body is StandardErrorResponse {
    const res = body as StandardErrorResponse;
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(expectedStatus);
    expect(typeof res.message).toBe('string');
    expect(res.message.length).toBeGreaterThan(0);
    expect(typeof res.timestamp).toBe('string');
}

describe('SQL Engine E2E Tests', () => {
    let app: INestApplication;

    beforeAll(async () => {
        process.env.DB_DATA_FOLDER = './test/data';
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Attach any global pipes, interceptors, or exception filters here
        // if they are registered in main.ts rather than via module providers.
        await app.init();
    });

    afterAll(async () => {
        await app.close();
        await rm('./test/data', { recursive: true, force: true });
        delete process.env.DB_DATA_FOLDER;
    });

    it('runs full CREATE -> INSERT -> SELECT -> UPDATE -> DELETE -> DROP lifecycle', async () => {
        const server = app.getHttpServer();

        // 1. CREATE TABLE via /execute/ddl
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'CREATE TABLE users (id INT, name VARCHAR(255));' })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. INSERT via /execute/dml
        const insertRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO users (id, name) VALUES (1, 'Mohamed');",
            })
            .expect(200);
        assertSuccess(insertRes.body, 200);

        // 3. SELECT & verify inserted data
        const afterInsert = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM users;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(afterInsert.body, 200);
        expect(afterInsert.body.data).toEqual([{ id: 1, name: 'Mohamed' }]);

        // 4. UPDATE via /execute/dml
        const updateRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "UPDATE users SET name = 'Mohamed Updated' WHERE id = 1;",
            })
            .expect(200);
        assertSuccess(updateRes.body, 200);

        // 5. SELECT & verify updated data
        const afterUpdate = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM users;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(afterUpdate.body, 200);
        expect(afterUpdate.body.data).toEqual([
            { id: 1, name: 'Mohamed Updated' },
        ]);

        // 6. DELETE via /execute/dml
        const deleteRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'DELETE FROM users WHERE id = 1;' })
            .expect(200);
        assertSuccess(deleteRes.body, 200);

        // 7. SELECT & verify deletion
        const afterDelete = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM users;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(afterDelete.body, 200);
        expect(afterDelete.body.data).toEqual([]);

        // 8. DROP TABLE via /execute/ddl
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE users;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('returns StandardErrorResponse when selecting from a nonexistent table', async () => {
        const expectedStatus = 404; // Match your exception filter's status code

        const errRes = await request(app.getHttpServer())
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM nonexistent_table;' })
            .expect(expectedStatus);

        assertError(errRes.body, expectedStatus);
    });

    it('auto-increments SERIAL primary/id column on inserts', async () => {
        const server = app.getHttpServer();

        // 1. Create table with a SERIAL column
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE items (id SERIAL, title VARCHAR(255));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. Insert rows without specifying `id` (or if your parser expects/allows omitting SERIAL)
        const insertFirst = await request(server)
            .post('/execute/dml')
            .send({ query: "INSERT INTO items (title) VALUES ('First Item');" })
            .expect(200);
        assertSuccess(insertFirst.body, 200);

        const insertSecond = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO items (title) VALUES ('Second Item');",
            })
            .expect(200);
        assertSuccess(insertSecond.body, 200);

        // 3. SELECT & verify generated sequential IDs
        const selectRes1 = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM items;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes1.body, 200);
        expect(selectRes1.body.data).toEqual([
            { id: 1, title: 'First Item' },
            { id: 2, title: 'Second Item' },
        ]);

        const insertThird = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO items (title) VALUES ('Third Item');",
            })
            .expect(200);
        assertSuccess(insertThird.body, 200);

        const selectRes2 = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM items;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes2.body, 200);
        expect(selectRes2.body.data).toEqual([
            { id: 1, title: 'First Item' },
            { id: 2, title: 'Second Item' },
            { id: 3, title: 'Third Item' },
        ]);

        const deleteSecond = await request(server)
            .post('/execute/dml')
            .send({
                query: 'delete from items where id = 2;',
            })
            .expect(200);
        assertSuccess(deleteSecond.body, 200);

        const selectRes3 = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM items;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes3.body, 200);
        expect(selectRes3.body.data).toEqual([
            { id: 1, title: 'First Item' },
            { id: 3, title: 'Third Item' },
        ]);

        const deleteThird = await request(server)
            .post('/execute/dml')
            .send({
                query: 'delete from items where id = 3;',
            })
            .expect(200);
        assertSuccess(deleteThird.body, 200);

        const selectRes4 = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM items;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes4.body, 200);
        expect(selectRes4.body.data).toEqual([{ id: 1, title: 'First Item' }]);

        const insertFourth = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO items (title) VALUES ('Fourth Item');",
            })
            .expect(200);
        assertSuccess(insertFourth.body, 200);

        const selectRes5 = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM items;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes5.body, 200);
        expect(selectRes5.body.data).toEqual([
            { id: 1, title: 'First Item' },
            { id: 4, title: 'Fourth Item' },
        ]);

        const deleteAllRows = await request(server)
            .post('/execute/dml')
            .send({
                query: 'delete from items;',
            })
            .expect(200);
        assertSuccess(deleteAllRows.body, 200);

        const selectRes6 = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM items;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes6.body, 200);
        expect(selectRes6.body.data).toEqual([]);

        const insertFifth = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO items (title) VALUES ('Fifth Item');",
            })
            .expect(200);
        assertSuccess(insertFifth.body, 200);

        const selectRes7 = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM items;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes7.body, 200);
        expect(selectRes7.body.data).toEqual([{ id: 5, title: 'Fifth Item' }]);

        // 4. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE items;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('supports ORDER BY (ASC/DESC) and LIMIT on SELECT queries', async () => {
        const server = app.getHttpServer();

        // 1. Create table
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE products (id INT, name VARCHAR(255), price INT);',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. Seed rows in non-sorted order
        const inserts = [
            "INSERT INTO products (id, name, price) VALUES (1, 'Keyboard', 80);",
            "INSERT INTO products (id, name, price) VALUES (2, 'Monitor', 300);",
            "INSERT INTO products (id, name, price) VALUES (3, 'Mouse', 40);",
            "INSERT INTO products (id, name, price) VALUES (4, 'Laptop', 1200);",
        ];

        for (const query of inserts) {
            const res = await request(server)
                .post('/execute/dml')
                .send({ query })
                .expect(200);
            assertSuccess(res.body, 200);
        }

        // 3. ORDER BY ASC
        const ascRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM products ORDER BY price ASC;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(ascRes.body, 200);
        expect(ascRes.body.data).toEqual([
            { id: 3, name: 'Mouse', price: 40 },
            { id: 1, name: 'Keyboard', price: 80 },
            { id: 2, name: 'Monitor', price: 300 },
            { id: 4, name: 'Laptop', price: 1200 },
        ]);

        // 4. ORDER BY DESC
        const descRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM products ORDER BY price DESC;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(descRes.body, 200);
        expect(descRes.body.data).toEqual([
            { id: 4, name: 'Laptop', price: 1200 },
            { id: 2, name: 'Monitor', price: 300 },
            { id: 1, name: 'Keyboard', price: 80 },
            { id: 3, name: 'Mouse', price: 40 },
        ]);

        // 5. ORDER BY DESC + LIMIT
        const topTwoRes = await request(server)
            .post('/execute/dml')
            .send({
                query: 'SELECT * FROM products ORDER BY price DESC LIMIT 2;',
            })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(topTwoRes.body, 200);
        expect(topTwoRes.body.data).toEqual([
            { id: 4, name: 'Laptop', price: 1200 },
            { id: 2, name: 'Monitor', price: 300 },
        ]);

        // 6. Standalone LIMIT
        const limitRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM products LIMIT 2;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(limitRes.body, 200);
        expect(limitRes.body.data).toHaveLength(2);

        // 7. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE products;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('supports SELECT with aliases, single WHERE condition, ORDER BY, and LIMIT', async () => {
        const server = app.getHttpServer();

        // 1. Create table
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE orders (id INT, customer VARCHAR(255), total INT, status VARCHAR(50));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. Seed test rows
        const inserts = [
            `INSERT INTO orders 
                (id, customer, total, status) 
            VALUES 
                (1, 'Mohamed', 250, 'paid'),
                (2, 'Sara', 600, 'paid'),
                (3, 'Omar', 900, 'paid'),
                (4, 'Nadia', 1200, 'pending'),
                (5, 'Youssef', 400, 'paid');`,
        ];

        for (const query of inserts) {
            const res = await request(server)
                .post('/execute/dml')
                .send({ query })
                .expect(200);
            assertSuccess(res.body, 200);
        }

        // 3. Column aliases + single WHERE condition
        const aliasWhereRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "SELECT id AS order_id, customer AS buyer_name, total AS amount FROM orders WHERE status = 'paid';",
            })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(aliasWhereRes.body, 200);
        expect(aliasWhereRes.body.data).toEqual([
            { order_id: 1, buyer_name: 'Mohamed', amount: 250 },
            { order_id: 2, buyer_name: 'Sara', amount: 600 },
            { order_id: 3, buyer_name: 'Omar', amount: 900 },
            { order_id: 5, buyer_name: 'Youssef', amount: 400 },
        ]);

        // 4. Table alias + column aliases + single WHERE + ORDER BY + LIMIT
        const fullComboRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "SELECT o.customer AS buyer_name, o.total AS amount FROM orders o WHERE o.status = 'paid' ORDER BY o.total DESC LIMIT 2;",
            })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(fullComboRes.body, 200);
        expect(fullComboRes.body.data).toEqual([
            { buyer_name: 'Omar', amount: 900 },
            { buyer_name: 'Sara', amount: 600 },
        ]);

        // 5. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE orders;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('returns multiple records including NULL values and handles NULL filtering/sorting', async () => {
        const server = app.getHttpServer();

        // 1. Create table
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE employees (id INT, name VARCHAR(255), department VARCHAR(100), salary INT);',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. Seed multiple records, including NULL values
        const inserts = [
            "INSERT INTO employees (id, name, department, salary) VALUES (1, 'Mohamed', 'Backend', 1500);",
            "INSERT INTO employees (id, name, department, salary) VALUES (2, 'Sara', NULL, 1800);",
            "INSERT INTO employees (id, name, department, salary) VALUES (3, 'Omar', 'Frontend', NULL);",
            "INSERT INTO employees (id, name, department, salary) VALUES (4, NULL, 'DevOps', 2000);",
            "INSERT INTO employees (id, name, department, salary) VALUES (5, 'Nadia', NULL, NULL);",
            "INSERT INTO employees (id, name, department, salary) VALUES (6, 'Youssef', 'Backend', 1200);",
        ];

        for (const query of inserts) {
            const res = await request(server)
                .post('/execute/dml')
                .send({ query })
                .expect(200);
            assertSuccess(res.body, 200);
        }

        // 3. SELECT all records and verify NULL values are preserved
        const allRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM employees;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(allRes.body, 200);
        expect(allRes.body.data).toHaveLength(6);
        expect(allRes.body.data).toEqual([
            { id: 1, name: 'Mohamed', department: 'Backend', salary: 1500 },
            { id: 2, name: 'Sara', department: null, salary: 1800 },
            { id: 3, name: 'Omar', department: 'Frontend', salary: null },
            { id: 4, name: null, department: 'DevOps', salary: 2000 },
            { id: 5, name: 'Nadia', department: null, salary: null },
            { id: 6, name: 'Youssef', department: 'Backend', salary: 1200 },
        ]);

        // 4. Single WHERE condition matching a non-null value across multiple rows
        const backendRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "SELECT id AS emp_id, name AS emp_name, salary FROM employees WHERE department = 'Backend';",
            })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(backendRes.body, 200);
        expect(backendRes.body.data).toEqual([
            { emp_id: 1, emp_name: 'Mohamed', salary: 1500 },
            { emp_id: 6, emp_name: 'Youssef', salary: 1200 },
        ]);

        // 5. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE employees;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('returns a large result set cleanly and respects LIMIT on many rows', async () => {
        const server = app.getHttpServer();
        const totalRows = 150;

        // 1. Create table
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE metrics (id INT, tag VARCHAR(100), value INT);',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. Seed many rows to exercise page splitting / multi-record reads
        for (let i = 1; i <= totalRows; i++) {
            const tag = i % 2 === 0 ? 'even' : 'odd';
            const value = i * 10;
            const res = await request(server)
                .post('/execute/dml')
                .send({
                    query: `INSERT INTO metrics (id, tag, value) VALUES (${i}, '${tag}', ${value});`,
                })
                .expect(200);
            assertSuccess(res.body, 200);
        }

        // 3. SELECT all rows (large result set)
        const allRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM metrics;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(allRes.body, 200);
        expect(Array.isArray(allRes.body.data)).toBe(true);
        expect(allRes.body.data).toHaveLength(totalRows);
        expect(allRes.body.data[0]).toEqual({ id: 1, tag: 'odd', value: 10 });
        expect(allRes.body.data[totalRows - 1]).toEqual({
            id: totalRows,
            tag: 'even',
            value: totalRows * 10,
        });

        // 4. Bound the large result set with ORDER BY + LIMIT
        const topFiveRes = await request(server)
            .post('/execute/dml')
            .send({
                query: 'SELECT id, value FROM metrics ORDER BY value DESC LIMIT 5;',
            })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(topFiveRes.body, 200);
        expect(topFiveRes.body.data).toEqual([
            { id: 150, value: 1500 },
            { id: 149, value: 1490 },
            { id: 148, value: 1480 },
            { id: 147, value: 1470 },
            { id: 146, value: 1460 },
        ]);

        // 5. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE metrics;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('creates a table with all supported data types and returns many rows with NULLs and unique VARCHAR values', async () => {
        const server = app.getHttpServer();
        const totalRows = 120;

        // 1. Create wide table covering all supported datatypes
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query:
                    'CREATE TABLE all_types_bench (' +
                    'id SERIAL, ' +
                    'int_col INT, ' +
                    'integer_col INTEGER, ' +
                    'varchar_col VARCHAR(255), ' +
                    'char_col CHAR(10), ' +
                    'date_col DATE, ' +
                    'double_col DOUBLE, ' +
                    'ts_col TIMESTAMP, ' +
                    'dt_col DATETIME' +
                    ');',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. Seed many rows mixing NULL and non-NULL values, with a distinct VARCHAR per row
        const expectedRows: Record<string, unknown>[] = [];

        for (let i = 1; i <= totalRows; i++) {
            const uniqueVarchar = `unique_row_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const isNullPattern = i % 3;

            const intVal = isNullPattern === 1 ? 'NULL' : `${i * 2}`;
            const integerVal = isNullPattern === 2 ? 'NULL' : `${i * 100}`;
            const charVal =
                i % 4 === 0 ? 'NULL' : `'C${String(i).padStart(3, '0')}'`;
            const dateVal =
                i % 5 === 0
                    ? 'NULL'
                    : `'2026-01-${String((i % 28) + 1).padStart(2, '0')}'`;
            const doubleVal = i % 6 === 0 ? 'NULL' : `${(i * 1.25).toFixed(2)}`;
            const tsVal =
                i % 7 === 0
                    ? 'NULL'
                    : `'2026-01-15 10:20:${String(i % 60).padStart(2, '0')}'`;
            const dtVal =
                i % 8 === 0
                    ? 'NULL'
                    : `'2026-02-20 14:30:${String(i % 60).padStart(2, '0')}'`;

            const query =
                `INSERT INTO all_types_bench ` +
                `(int_col, integer_col, varchar_col, char_col, date_col, double_col, ts_col, dt_col) ` +
                `VALUES (${intVal}, ${integerVal}, '${uniqueVarchar}', ${charVal}, ${dateVal}, ${doubleVal}, ${tsVal}, ${dtVal});`;

            const insertRes = await request(server)
                .post('/execute/dml')
                .send({ query })
                .expect(200);
            assertSuccess(insertRes.body, 200);

            expectedRows.push({
                id: i,
                int_col: isNullPattern === 1 ? null : i * 2,
                integer_col: isNullPattern === 2 ? null : i * 100,
                varchar_col: uniqueVarchar,
                char_col: i % 4 === 0 ? null : `C${String(i).padStart(3, '0')}`,
                date_col:
                    i % 5 === 0
                        ? null
                        : `2026-01-${String((i % 28) + 1).padStart(2, '0')} 00:00:00`,
                double_col: i % 6 === 0 ? null : Number((i * 1.25).toFixed(2)),
                ts_col:
                    i % 7 === 0
                        ? null
                        : `2026-01-15 10:20:${String(i % 60).padStart(2, '0')}`,
                dt_col:
                    i % 8 === 0
                        ? null
                        : `2026-02-20 14:30:${String(i % 60).padStart(2, '0')}`,
            });
        }

        // 3. SELECT all rows and assert count, uniqueness of VARCHAR, NULLs, and values
        const selectRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM all_types_bench;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes.body, 200);

        const rows = selectRes.body.data;
        expect(Array.isArray(rows)).toBe(true);
        expect(rows).toHaveLength(totalRows);

        const varcharValues = rows.map((r) => r.varchar_col);
        expect(new Set(varcharValues).size).toBe(totalRows);
        expect(rows).toEqual(expectedRows);

        // 4. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE all_types_bench;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('validates DDL duplicate table creation and dropping a nonexistent table', async () => {
        const server = app.getHttpServer();
        const expectedErrorStatus = 400; // Adjust if your DDL filter returns 404/409/422

        // 1. Create table
        const firstCreate = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE ddl_users (id INT, name VARCHAR(255));',
            })
            .expect(200);
        assertSuccess(firstCreate.body, 200);

        // 2. Duplicate CREATE TABLE -> error
        const duplicateCreate = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE ddl_users (id INT, name VARCHAR(255));',
            })
            .expect(expectedErrorStatus);
        assertError(duplicateCreate.body, expectedErrorStatus);

        // 3. Clean up existing table
        const dropExisting = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE ddl_users;' })
            .expect(200);
        assertSuccess(dropExisting.body, 200);

        // 4. DROP nonexistent table -> error
        const dropMissing = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE nonexistent_table;' })
            .expect(expectedErrorStatus);
        assertError(dropMissing.body, expectedErrorStatus);
    });

    it('validates nonexistent columns across SELECT, ORDER BY, UPDATE, and DELETE', async () => {
        const server = app.getHttpServer();
        const expectedErrorStatus = 400; // Adjust to match your column validation status

        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE col_check (id INT, name VARCHAR(255));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        const seedRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO col_check (id, name) VALUES (1, 'Mohamed');",
            })
            .expect(200);
        assertSuccess(seedRes.body, 200);

        const invalidColumnQueries = [
            'SELECT unknown FROM col_check;',
            'SELECT * FROM col_check ORDER BY unknown;',
            "UPDATE col_check SET unknown = 'x';",
            'DELETE FROM col_check WHERE unknown = 1;',
        ];

        for (const query of invalidColumnQueries) {
            const errRes = await request(server)
                .post('/execute/dml')
                .send({ query })
                .expect(expectedErrorStatus);
            assertError(errRes.body, expectedErrorStatus);
        }

        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE col_check;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('rejects invalid INSERT column names and datatype mismatches', async () => {
        const server = app.getHttpServer();
        const expectedErrorStatus = 400;

        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE insert_check (id INT, name VARCHAR(255));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 1. Nonexistent column in INSERT
        const badColRes = await request(server)
            .post('/execute/dml')
            .send({
                query: 'INSERT INTO insert_check (nonexistent_column) VALUES (1);',
            })
            .expect(expectedErrorStatus);
        assertError(badColRes.body, expectedErrorStatus);

        // 2. Datatype mismatch in INSERT
        const badTypeRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO insert_check (id) VALUES ('not an integer');",
            })
            .expect(expectedErrorStatus);
        assertError(badTypeRes.body, expectedErrorStatus);

        // Optional constraint checks (uncomment if your engine supports PRIMARY KEY / UNIQUE / NOT NULL):
        // const dupPkRes = await request(server)
        //     .post('/execute/dml')
        //     .send({ query: "INSERT INTO insert_check (id, name) VALUES (1, 'Dup');" })
        //     .expect(expectedErrorStatus);
        // assertError(dupPkRes.body, expectedErrorStatus);

        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE insert_check;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('rejects invalid UPDATE column names and datatype mismatches', async () => {
        const server = app.getHttpServer();
        const expectedErrorStatus = 400;

        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE update_check (id INT, name VARCHAR(255));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        const seedRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO update_check (id, name) VALUES (1, 'Mohamed');",
            })
            .expect(200);
        assertSuccess(seedRes.body, 200);

        // 1. Nonexistent column in UPDATE
        const badColRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "UPDATE update_check SET nonexistent = 'x' WHERE id = 1;",
            })
            .expect(expectedErrorStatus);
        assertError(badColRes.body, expectedErrorStatus);

        // 2. Datatype mismatch in UPDATE
        const badTypeRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "UPDATE update_check SET id = 'invalid' WHERE id = 1;",
            })
            .expect(expectedErrorStatus);
        assertError(badTypeRes.body, expectedErrorStatus);

        // Optional UNIQUE constraint check (uncomment if supported):
        // const dupUniqueRes = await request(server)
        //     .post('/execute/dml')
        //     .send({
        //         query: "UPDATE update_check SET email = 'existing@email.com' WHERE id = 2;",
        //     })
        //     .expect(expectedErrorStatus);
        // assertError(dupUniqueRes.body, expectedErrorStatus);

        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE update_check;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('handles DELETE with no matching rows without corrupting existing data', async () => {
        const server = app.getHttpServer();

        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE del_check (id INT, name VARCHAR(255));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        const seedRows = [
            "INSERT INTO del_check (id, name) VALUES (1, 'Mohamed');",
            "INSERT INTO del_check (id, name) VALUES (2, 'Sara');",
        ];
        for (const query of seedRows) {
            const res = await request(server)
                .post('/execute/dml')
                .send({ query })
                .expect(200);
            assertSuccess(res.body, 200);
        }

        // DELETE matching nothing
        const deleteMissingRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'DELETE FROM del_check WHERE id = 999;' })
            .expect(200);
        assertSuccess(deleteMissingRes.body, 200);

        // Existing rows should remain intact
        const selectRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM del_check;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes.body, 200);
        expect(selectRes.body.data).toEqual([
            { id: 1, name: 'Mohamed' },
            { id: 2, name: 'Sara' },
        ]);

        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE del_check;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('returns an empty array [] for SELECT with no matching rows on an existing table', async () => {
        const server = app.getHttpServer();

        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE empty_match (id INT, name VARCHAR(255));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        const seedRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO empty_match (id, name) VALUES (1, 'Mohamed');",
            })
            .expect(200);
        assertSuccess(seedRes.body, 200);

        const selectMissingRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM empty_match WHERE id = 999;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectMissingRes.body, 200);
        expect(selectMissingRes.body.data).toEqual([]);

        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE empty_match;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('rejects unsupported SQL commands and malformed SQL syntax with 4xx StandardErrorResponse', async () => {
        const server = app.getHttpServer();

        // 1. Unsupported command (e.g. ALTER TABLE / TRUNCATE)
        const unsupportedRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'ALTER TABLE users ADD COLUMN age INT;' });

        expect(unsupportedRes.status).toBeGreaterThanOrEqual(400);
        expect(unsupportedRes.status).toBeLessThan(500);
        assertError(unsupportedRes.body, unsupportedRes.status);

        // 2. Malformed SQL syntax
        const malformedRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT FROM users;' });

        expect(malformedRes.status).toBeGreaterThanOrEqual(400);
        expect(malformedRes.status).toBeLessThan(500);
        assertError(malformedRes.body, malformedRes.status);
    });

    it('supports UPDATE across single/multiple rows, multiple columns, NULL values, and non-matching WHERE', async () => {
        const server = app.getHttpServer();

        // 1. Create table
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query: 'CREATE TABLE accounts (id INT, owner VARCHAR(255), balance INT, tier VARCHAR(50));',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. Seed rows
        const inserts = [
            "INSERT INTO accounts (id, owner, balance, tier) VALUES (1, 'Mohamed', 500, 'standard');",
            "INSERT INTO accounts (id, owner, balance, tier) VALUES (2, 'Sara', 1200, 'standard');",
            "INSERT INTO accounts (id, owner, balance, tier) VALUES (3, 'Omar', 800, 'standard');",
        ];

        for (const query of inserts) {
            const res = await request(server)
                .post('/execute/dml')
                .send({ query })
                .expect(200);
            assertSuccess(res.body, 200);
        }

        // 3. Single-row UPDATE with multiple columns
        const multiColUpdate = await request(server)
            .post('/execute/dml')
            .send({
                query: "UPDATE accounts SET balance = 2500, tier = 'vip' WHERE id = 2;",
            })
            .expect(200);
        assertSuccess(multiColUpdate.body, 200);

        // 4. Multi-row UPDATE matching a single WHERE condition
        const multiRowUpdate = await request(server)
            .post('/execute/dml')
            .send({
                query: "UPDATE accounts SET tier = 'active' WHERE tier = 'standard';",
            })
            .expect(200);
        assertSuccess(multiRowUpdate.body, 200);

        // 5. Update a column to NULL
        const setNullUpdate = await request(server)
            .post('/execute/dml')
            .send({
                query: 'UPDATE accounts SET tier = NULL WHERE id = 1;',
            })
            .expect(200);
        assertSuccess(setNullUpdate.body, 200);

        // 6. UPDATE with non-matching WHERE should leave rows unchanged
        const noMatchUpdate = await request(server)
            .post('/execute/dml')
            .send({
                query: 'UPDATE accounts SET balance = 99999 WHERE id = 999;',
            })
            .expect(200);
        assertSuccess(noMatchUpdate.body, 200);

        // 7. Verify final state
        const selectRes = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM accounts;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectRes.body, 200);
        expect(selectRes.body.data).toEqual([
            { id: 1, owner: 'Mohamed', balance: 500, tier: null },
            { id: 2, owner: 'Sara', balance: 2500, tier: 'vip' },
            { id: 3, owner: 'Omar', balance: 800, tier: 'active' },
        ]);

        // 8. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE accounts;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });

    it('enforces NOT NULL and applies DEFAULT values across CREATE TABLE, INSERT, and UPDATE', async () => {
        const server = app.getHttpServer();
        const expectedErrorStatus = 400; // Adjust if your constraint validator returns another 4xx status

        // 1. CREATE TABLE with NOT NULL and DEFAULT constraints
        const createRes = await request(server)
            .post('/execute/ddl')
            .send({
                query:
                    'CREATE TABLE profiles (' +
                    'id INT NOT NULL, ' +
                    "role VARCHAR(50) NOT NULL DEFAULT 'member', " +
                    'credits INT DEFAULT 10, ' +
                    'bio VARCHAR(255)' +
                    ');',
            })
            .expect(200);
        assertSuccess(createRes.body, 200);

        // 2. INSERT omitting defaulted columns -> applies DEFAULT values
        const insertDefaultsRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO profiles (id, bio) VALUES (1, 'Backend dev');",
            })
            .expect(200);
        assertSuccess(insertDefaultsRes.body, 200);

        // 3. INSERT with explicit values overriding DEFAULTs and nullable column left NULL
        const insertExplicitRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO profiles (id, role, credits, bio) VALUES (2, 'admin', 50, NULL);",
            })
            .expect(200);
        assertSuccess(insertExplicitRes.body, 200);

        // 4. INSERT violating NOT NULL by passing NULL into a NOT NULL column -> error
        const insertNullNotNullRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO profiles (id, role, credits, bio) VALUES (3, NULL, 20, 'Test');",
            })
            .expect(expectedErrorStatus);
        assertError(insertNullNotNullRes.body, expectedErrorStatus);

        // 5. INSERT omitting a NOT NULL column that has NO DEFAULT -> error
        const insertMissingNotNullRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "INSERT INTO profiles (role, credits) VALUES ('member', 10);",
            })
            .expect(expectedErrorStatus);
        assertError(insertMissingNotNullRes.body, expectedErrorStatus);

        // 6. SELECT after inserts to verify DEFAULTs and NULLs
        const selectAfterInsert = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM profiles;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectAfterInsert.body, 200);
        expect(selectAfterInsert.body.data).toEqual([
            { id: 1, role: 'member', credits: 10, bio: 'Backend dev' },
            { id: 2, role: 'admin', credits: 50, bio: null },
        ]);

        // 7. UPDATE valid values (including updating nullable column and non-null column)
        const updateValidRes = await request(server)
            .post('/execute/dml')
            .send({
                query: "UPDATE profiles SET credits = 25, bio = 'Updated bio' WHERE id = 1;",
            })
            .expect(200);
        assertSuccess(updateValidRes.body, 200);

        // 8. UPDATE violating NOT NULL by setting a NOT NULL column to NULL -> error
        const updateNullNotNullRes = await request(server)
            .post('/execute/dml')
            .send({
                query: 'UPDATE profiles SET role = NULL WHERE id = 1;',
            })
            .expect(expectedErrorStatus);
        assertError(updateNullNotNullRes.body, expectedErrorStatus);

        // 9. SELECT final state and confirm failed UPDATE did not corrupt row 1
        const selectFinal = await request(server)
            .post('/execute/dml')
            .send({ query: 'SELECT * FROM profiles;' })
            .expect(200);
        assertSuccess<Record<string, unknown>[]>(selectFinal.body, 200);
        expect(selectFinal.body.data).toEqual([
            { id: 1, role: 'member', credits: 25, bio: 'Updated bio' },
            { id: 2, role: 'admin', credits: 50, bio: null },
        ]);

        // 10. Clean up table
        const dropRes = await request(server)
            .post('/execute/ddl')
            .send({ query: 'DROP TABLE profiles;' })
            .expect(200);
        assertSuccess(dropRes.body, 200);
    });
});
