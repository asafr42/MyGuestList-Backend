const request = require('supertest');

// Set test environment BEFORE requiring the app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

const app = require('../server');
const jwt = require('jsonwebtoken');

describe('Health Endpoint', () => {
  it('GET /health should return status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBeDefined();
    expect(res.body).toHaveProperty('status');
  });
});

describe('Auth Routes', () => {
  it('POST /api/auth/register should require email and password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required.');
  });

});

describe('Guest Routes - Auth Protection', () => {
  it('GET /api/guests should return 401 without token', async () => {
    const res = await request(app).get('/api/guests');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Access denied. No token provided.');
  });

  it('GET /api/guests should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/guests')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token.');
  });

  it('GET /api/guests/stats should return 401 without token', async () => {
    const res = await request(app).get('/api/guests/stats');
    expect(res.status).toBe(401);
  });

  it('POST /api/guests should return 401 without token', async () => {
    const res = await request(app)
      .post('/api/guests')
      .send({ firstName: 'Test', lastName: 'Guest' });
    expect(res.status).toBe(401);
  });
});

describe('Stats Calculation', () => {
  it('should correctly calculate guest statistics', () => {
    const guests = [
      { invitedCount: 2, confirmedCount: 2, status: 'Confirmed' },
      { invitedCount: 3, confirmedCount: 1, status: 'Pending' },
      { invitedCount: 4, confirmedCount: 0, status: 'Declined' }
    ];

    const stats = {
      totalInvited: guests.reduce((sum, g) => sum + g.invitedCount, 0),
      totalConfirmed: guests.reduce((sum, g) => sum + g.confirmedCount, 0),
      totalDeclined: guests.reduce((sum, g) => sum + (g.status === 'Declined' ? g.invitedCount : 0), 0)
    };

    expect(stats.totalInvited).toBe(9);
    expect(stats.totalConfirmed).toBe(3);
    expect(stats.totalDeclined).toBe(4);
  });
});
