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
const stockoutCounter = new Counter('purchase_stockout_total');
const otherFailCounter = new Counter('purchase_other_fail_total');

export const options = {
    thresholds: {
        http_req_duration: ['p(95)<200'], // More aggressive threshold for Cloud Run
        http_req_failed: ['rate<0.01'],
    },
    scenarios: {
        drop_simulation: {
            executor: 'ramping-arrival-rate',
            startRate: 10,
            timeUnit: '1s',
            preAllocatedVUs: 100,
            maxVUs: 200,
            stages: [
                { target: 100, duration: '30s' }, // Rapid ramp up to push the limits
                { target: 100, duration: '30s' }, // Sustained high load
                { target: 0, duration: '10s' },   // Ramp down
            ],
        },
    },
};

export default function () {
    // 10% of users simulate a 'Bot' (reduced ratio but higher absolute frequency)
    const isBot = Math.random() < 0.1;
    const userId = isBot ? `bot_user_${__VU}` : `user_${__VU}_${__ITER}`;

    const sizes = ["US9", "US10", "US11"];
    const targetSize = sizes[Math.floor(Math.random() * sizes.length)];
    const isPremium = Math.random() > 0.8 ? 1 : 0;

    // [1] GET /api/search
    // Increased frequency to match previous 'heavy' test patterns
    const searchRes = http.get(`${BASE_URL}/api/search?premium=${isPremium}&budget=100000`);
    check(searchRes, { 'search status 200': (r) => r.status === 200 });

    // Minimal think time to maximize RPS as per feedback
    sleep(Math.random() * 0.1 + 0.05);

    // [2] POST /api/buy
    const payload = JSON.stringify({
        id: 1,
        size: targetSize,
        user_id: userId,
        premium: isPremium
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const buyRes = http.post(`${BASE_URL}/api/buy`, payload, params);

    if (check(buyRes, { 'buy status 200': (r) => r.status === 200 })) {
        try {
            const body = JSON.parse(buyRes.body);
            // Support both direct response (Cloud Run) and ORDS wrapper (Oracle)
            const result = body.p_status ? JSON.parse(body.p_status) : body;

            if (result.status === 'SUCCESS') {
                successCounter.add(1);
            } else if (result.status === 'REJECTED') {
                rejectedCounter.add(1);
            } else if (result.status === 'FAIL' && result.message === '在庫切れです') {
                stockoutCounter.add(1);
            } else {
                otherFailCounter.add(1);
            }
        } catch (e) {
            console.error(`Failed to parse response: ${buyRes.body}`);
        }
    } else {
        otherFailCounter.add(1);
    }

    // Small sleep at end of iteration
    sleep(0.1);
}
