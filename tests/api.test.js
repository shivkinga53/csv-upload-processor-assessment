import request from 'supertest';
import app from '../src/app.js';
import sequelize from '../src/config/database.js';
import redisConnection from '../src/config/redis.js';

beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
});

describe('API Endpoint Permutations', () => {
    it('should reject non-CSV file types immediately (400)', async () => {
        const buffer = Buffer.from('this is a text file');
        const res = await request(app)
            .post('/upload')
            .attach('file', buffer, 'notes.txt');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Please upload a .csv file');
    });

    it('should return 200 OK for health check', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
    });

    it('should return 404 for a non-existent Job ID', async () => {
        const fakeUuid = '00000000-0000-0000-0000-000000000000';
        const res = await request(app).get(`/status/${fakeUuid}`);
        expect(res.status).toBe(404);
    });

    it('should return a paginated list of transactions', async () => {
        const res = await request(app).get('/transactions?page=1&limit=5');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('transactions');
        expect(Array.isArray(res.body.transactions)).toBe(true);
    });

    it('should reject a global export if date range exceeds 90 days', async () => {
        const res = await request(app)
            .get('/transactions/export?startDate=2024-01-01&endDate=2024-06-01');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Date range cannot exceed 90 days');
    });

    it('should reject export if dates are missing', async () => {
        const res = await request(app).get('/transactions/export');
        expect(res.status).toBe(400);
    });
});

afterAll(async () => {
    await sequelize.close();
    if (redisConnection) await redisConnection.quit();
    await new Promise(resolve => setTimeout(resolve, 500));
});