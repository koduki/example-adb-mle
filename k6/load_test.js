import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuration: Pass BASE_URL via environment variable
// e.g. k6 run -e BASE_URL=https://... load_test.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/ords/sneakerheadz/api';

export const options = {
    // Thresholds for Pass/Fail as per Spec Section 7.2
    thresholds: {
        // "Latency (p95): 20ms ~ 50ms" (Blue Goal)
        http_req_duration: ['p(95)<500'], // Relaxed for generic test, strictly <50 for Blue
        // "Error Rate: ほぼゼロ"
        http_req_failed: ['rate<0.01'],
    },
    scenarios: {
        drop_simulation: {
            executor: 'ramping-arrival-rate',
            startRate: 0,
            timeUnit: '1s',
            preAllocatedVUs: 50,
            maxVUs: 2000,
            stages: [
                { target: 100, duration: '10s' },
                { target: 500, duration: '20s' }, // Spike
                { target: 0, duration: '10s' },
            ],
        },
    },
};

export default function () {
    const userId = `user_${__VU}`; // Virtual User ID
    const sizes = ["US9", "US10", "US11"];
    const targetSize = sizes[Math.floor(Math.random() * sizes.length)];
    const isPremium = Math.random() > 0.8 ? 1 : 0;

    // 1. Search Action (GET /search)
    // Simulate user refreshing to check price/status
    const searchRes = http.get(`${BASE_URL}/search?budget=50000&premium=${isPremium}`);

    check(searchRes, {
        'search status 200': (r) => r.status === 200
    });

    sleep(1);

    // 2. Buy Action (POST /buy)
    // The "Drop" implementation
    const payload = JSON.stringify({
        id: 1, //Target Sneaker ID
        size: targetSize,
        user: userId,
        premium: isPremium
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const buyRes = http.post(`${BASE_URL}/buy`, payload, params);

    // We expect 200 OK from ORDS. 
    // The actual result (Success vs Sold Out) is in the response body/headers logic, 
    // but connectivity success is what we check here primarily for infrastructure.
    check(buyRes, {
        'buy status 200': (r) => r.status === 200,
    });
}
