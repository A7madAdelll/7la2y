// k6 load test for STAGING (never production). Measures what the local DB test cannot:
// network Egypt -> Vercel/Supabase, page rendering, and Supabase API under 10,000 open ticket pages.
//
//   k6 run -e BASE_URL=https://<staging-site> -e SUPABASE_URL=https://<ref>.supabase.co \
//          -e ANON_KEY=<anon key> -e SHOP=<shop slug> -e TOKENS=<comma-separated ticket tokens> load/k6-staging.js
//
// Make tickets first (join a few times on staging) and paste their tokens from the /t/<token> URLs.
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    // People scanning the QR code: the shop page.
    qr_page: { executor: "constant-arrival-rate", rate: 50, timeUnit: "1s", duration: "2m", preAllocatedVUs: 100, exec: "shopPage" },
    // Open ticket pages refetching their status after a ping (10,000 pages, ~1 refetch / 10 s each).
    ticket_refresh: { executor: "constant-arrival-rate", rate: 1000, timeUnit: "1s", duration: "2m", preAllocatedVUs: 500, exec: "ticketStatus" },
  },
  thresholds: {
    "http_req_duration{scenario:qr_page}": ["p(95)<2000"], // page usable < 2 s
    "http_req_duration{scenario:ticket_refresh}": ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

const tokens = (__ENV.TOKENS || "").split(",").filter(Boolean);

export function shopPage() {
  const res = http.get(`${__ENV.BASE_URL}/${__ENV.SHOP}`);
  check(res, { "shop page 200": (r) => r.status === 200 });
}

export function ticketStatus() {
  const token = tokens[Math.floor(Math.random() * tokens.length)];
  const res = http.post(`${__ENV.SUPABASE_URL}/rest/v1/rpc/entry_status`, JSON.stringify({ p_token: token }), {
    headers: { apikey: __ENV.ANON_KEY, Authorization: `Bearer ${__ENV.ANON_KEY}`, "Content-Type": "application/json" },
  });
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(0.1);
}
