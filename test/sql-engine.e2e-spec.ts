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
            .send({ query: "INSERT INTO users (id, name) VALUES (1, 'Mohamed');" })
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
});
