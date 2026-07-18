import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.E2E_BASE_URL || 'https://192.168.8.217';
const USERNAME = __ENV.E2E_USERNAME || 'e2e_test_user';
const PASSWORD = __ENV.E2E_PASSWORD || 'E2ePlaywright2026!';

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },   // ramp up to 20 concurrent users
        { duration: '1m',  target: 20 },   // hold at 20 for 1 minute
        { duration: '30s', target: 50 },   // spike to 50 (simulating clock-in rush)
        { duration: '1m',  target: 50 },   // hold at 50
        { duration: '30s', target: 0 },    // ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],   // 95% of requests should complete under 1s
    // http_req_failed is not used as a threshold here since 403 on the
    // alerts endpoint is expected behavior for the EMPLOYEE test role,
    // not a real failure. Correctness is verified by the checks below instead.
    checks: ['rate>0.99'],                // our own pass/fail logic must hold 99%+
  },
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login/`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, {
    'login succeeded': (r) => r.status === 200,
  });

  const token = loginRes.json('access');
  return { token };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  const active = http.get(`${BASE_URL}/api/hr/employees/active/`, { headers });
  check(active, {
    'active employees status 200': (r) => r.status === 200,
  });

  const unread = http.get(`${BASE_URL}/api/hr/alerts/inbox/unread_count/`, { headers });
  check(unread, {
    'unread count responded': (r) => r.status === 200 || r.status === 403,
    // 403 is acceptable here since e2e_test_user is EMPLOYEE role, not HR
  });

  sleep(1);
}
