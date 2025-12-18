import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

/**
 * k6 Load Test for SneakerHeadz Blitz
 * Demonstrates Bot Protection (Anti-Resale) effects.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/ords/sneakerheadz';

// Custom metrics to track Bot protection behavior
const successCounter = new Counter('purchase_success_total');
const rejectedCounter = new Counter('purchase_rejected_total');

export const options = {
    thresholds: {
        http_req_duration: ['p(95)<500'], // One-shot logic might be slightly heavier but saves RTT
        http_req_failed: ['rate<0.01'],
    },
    scenarios: {
        drop_simulation: {
            executor: 'ramping-arrival-rate',
            startRate: 5,
            timeUnit: '1s',
            preAllocatedVUs: 50,
            maxVUs: 200,
            stages: [
                { target: 20, duration: '20s' }, // Warm up
                { target: 50, duration: '40s' }, // peak
                { target: 0, duration: '10s' },  // Ramp down
            ],
        },
    },
};

export default function () {
    // 20% of users simulate a 'Bot' by reusing an ID based on their VU number
    // Others use a unique combination to ensure success (initial attempts)
    const isBot = Math.random() < 0.2;
    const userId = isBot ? `bot_user_${__VU}` : `user_${__VU}_${__ITER}`;

    const sizes = ["US9", "US10", "US11"];
    const targetSize = sizes[Math.floor(Math.random() * sizes.length)];
    const isPremium = Math.random() > 0.8 ? 1 : 0;

    // [1] GET /api/search
    const searchRes = http.get(`${BASE_URL}/api/search?premium=${isPremium}&budget=100000`);
    check(searchRes, { 'search status 200': (r) => r.status === 200 });

    // Think time
    sleep(Math.random() * 0.3 + 0.1);

    // [2] POST /api/buy
    const payload = JSON.stringify({
        id: 1,
        size: targetSize,
        user: userId,
        premium: isPremium
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const buyRes = http.post(`${BASE_URL}/api/buy`, payload, params);

    if (check(buyRes, { 'buy status 200': (r) => r.status === 200 })) {
        try {
            // response.p_status is the serialized JSON from our PL/SQL wrapper
            const body = JSON.parse(buyRes.body);
            const ordsStatus = body.p_status ? JSON.parse(body.p_status) : body;

            if (ordsStatus.status === 'SUCCESS') {
                successCounter.add(1);
            } else if (ordsStatus.status === 'REJECTED') {
                rejectedCounter.add(1);
                // console.warn(`[REJECTED] User ${userId}: ${ordsStatus.message}`);
            }
        } catch (e) {
            console.error(`Failed to parse response: ${buyRes.body}`);
        }
    } else {
        console.error(`[Buy] HTTP Error ${buyRes.status}: ${buyRes.body}`);
    }

    sleep(0.5);
}
