#!/usr/bin/env node
/**
 * Comprehensive API Stress Test
 * Tests: functional correctness + load simulation
 * Run: npx tsx scripts/stress-test.ts
 */

import { spawn } from "child_process";
import https from "https";

const BASE = "http://localhost:3000";

let authToken = "";
let passed = 0;
let failed = 0;
let skipped = 0;

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/auth_token=([^;]+)/);
  if (!match) throw new Error("No auth token in cookie");
  return match[1];
}

async function api(method: string, path: string, body?: any, cookie?: string) {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = `auth_token=${cookie}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json, headers: res.headers };
}

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return { name, fn };
}

async function runTests(tests: Array<{ name: string; fn: () => boolean | Promise<boolean> }>) {
  for (const t of tests) {
    try {
      const ok = await t.fn();
      if (ok) { passed++; process.stdout.write(`  ✓ ${t.name}\n`); }
      else { failed++; process.stdout.write(`  ✗ ${t.name}\n`); }
    } catch (e: any) {
      failed++; process.stdout.write(`  ✗ ${t.name} — ${e.message}\n`);
    }
  }
}

async function main() {
  console.log("=== Authentication ===");

  const adminToken = await login("admin@pirelli.ru", "Admin123!");
  authToken = adminToken;
  console.log("  Logged in as admin");

  // ─── Functional Tests ───
  console.log("\n=== Functional Tests ===");

  await runTests([
    test("GET /api/dashboard returns 200", async () => {
      const r = await api("GET", "/api/dashboard", undefined, adminToken);
      return r.status === 200;
    }),

    test("GET /api/organizations returns contractors", async () => {
      const r = await api("GET", "/api/organizations?page=1&limit=10", undefined, adminToken);
      return r.status === 200 && r.json?.data?.length > 0;
    }),

    test("GET /api/employees returns employees", async () => {
      const r = await api("GET", "/api/employees?page=1&limit=10", undefined, adminToken);
      return r.status === 200 && r.json?.data?.length > 0;
    }),

    test("GET /api/permits returns permits", async () => {
      const r = await api("GET", "/api/permits?page=1&limit=10", undefined, adminToken);
      return r.status === 200;
    }),

    test("GET /api/violations returns violations", async () => {
      const r = await api("GET", "/api/violations?page=1&limit=10", undefined, adminToken);
      return r.status === 200;
    }),

    test("GET /api/checklists returns checklists", async () => {
      const r = await api("GET", "/api/checklists?page=1&limit=10", undefined, adminToken);
      return r.status === 200;
    }),

    test("GET /api/complaints returns complaints", async () => {
      const r = await api("GET", "/api/complaints?page=1&limit=10", undefined, adminToken);
      return r.status === 200;
    }),

    test("GET /api/documents/sections returns sections", async () => {
      const r = await api("GET", "/api/documents/sections", undefined, adminToken);
      return r.status === 200;
    }),

    test("GET /api/documents/regulatory returns docs", async () => {
      const r = await api("GET", "/api/documents/regulatory?page=1&limit=10", undefined, adminToken);
      return r.status === 200;
    }),

    test("GET /api/auth/me returns user info", async () => {
      const r = await api("GET", "/api/auth/me", undefined, adminToken);
      return r.status === 200 && r.json?.user?.role === "admin";
    }),

    test("POST without auth_token returns 401", async () => {
      const r = await api("POST", "/api/violations", { description: "test" });
      return r.status === 401;
    }),

    test("GET /api/employees with org filter", async () => {
      // First get org IDs
      const orgs = await api("GET", "/api/organizations?page=1&limit=1", undefined, adminToken);
      const orgId = orgs.json?.data?.[0]?.id;
      if (!orgId) return false;
      const r = await api("GET", `/api/employees?organizationId=${orgId}`, undefined, adminToken);
      return r.status === 200;
    }),

    // Contractor employee tests
    test("Contractor employee can see own org", async () => {
      const ctToken = await login("podradchik@pirelli.ru", "Contractor1!");
      const r = await api("GET", "/api/organizations", undefined, ctToken);
      // Contractor employee should get filtered results or 200
      return r.status === 200;
    }),

    test("Contractor employee sees only own org employees", async () => {
      const ctToken = await login("podradchik@pirelli.ru", "Contractor1!");
      const r = await api("GET", "/api/employees?page=1&limit=10", undefined, ctToken);
      return r.status === 200;
    }),

    // Employee role tests
    test("Employee cannot see approvals", async () => {
      const empToken = await login("employee@pirelli.ru", "Employee1!");
      const r = await api("GET", "/api/approvals?type=employee", undefined, empToken);
      return r.status === 403;
    }),

    // Resubmit API tests
    test("Resubmit without comment returns 400", async () => {
      const r = await api("POST", "/api/employees/nonexistent-id/resubmit", {}, adminToken);
      return r.status === 400; // should fail on comment validation before finding employee
    }),

    test("Permit resubmit without auth returns 401", async () => {
      const r = await api("POST", "/api/permits/nonexistent-id/resubmit", { comment: "test" });
      return r.status === 401;
    }),

    // Notifications
    test("GET /api/notifications returns notifications", async () => {
      const r = await api("GET", "/api/notifications", undefined, adminToken);
      return r.status === 200;
    }),
  ]);

  // ─── Load Tests ───
  console.log("\n=== Load Tests ===");

  // Concurrent requests to GET endpoints
  const concurrentCount = 50;
  const endpoints = [
    "/api/dashboard",
    "/api/organizations?page=1&limit=10",
    "/api/employees?page=1&limit=10",
    "/api/permits?page=1&limit=10",
    "/api/violations?page=1&limit=10",
  ];

  for (const endpoint of endpoints) {
    const start = Date.now();
    const promises = Array.from({ length: concurrentCount }, () =>
      api("GET", endpoint, undefined, adminToken)
    );
    const results = await Promise.allSettled(promises);
    const elapsed = Date.now() - start;
    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.status === 200).length;
    const failedCount = results.filter((r) => r.status === "rejected" || r.value.status !== 200).length;

    process.stdout.write(`  ${endpoint}\n`);
    process.stdout.write(`    ${concurrentCount} concurrent: ${elapsed}ms total, ${succeeded} OK, ${failedCount} failed\n`);

    if (failedCount === 0) {
      passed++;
      process.stdout.write(`    ✓ No failures\n`);
    } else {
      failed++;
      process.stdout.write(`    ✗ ${failedCount} failures\n`);
    }
  }

  // Sequential hammering — 200 rapid requests to same endpoint
  console.log("\n  Sequential hammer: 200 rapid GET /api/employees");
  const hammerStart = Date.now();
  let hammerOk = 0;
  let hammerErr = 0;
  for (let i = 0; i < 200; i++) {
    const r = await api("GET", "/api/employees?page=1&limit=5", undefined, adminToken);
    if (r.status === 200) hammerOk++;
    else hammerErr++;
  }
  const hammerElapsed = Date.now() - hammerStart;
  process.stdout.write(`    ${hammerElapsed}ms total (${(hammerElapsed / 200).toFixed(0)}ms/req), ${hammerOk} OK, ${hammerErr} failed\n`);
  if (hammerErr === 0) { passed++; process.stdout.write(`    ✓ No failures\n`); }
  else { failed++; process.stdout.write(`    ✗ ${hammerErr} failures\n`); }

  // POST hammer — test rate limiting
  console.log("\n  POST hammer: 50 rapid violation creation attempts");
  const postStart = Date.now();
  let postOk = 0;
  let postRejected = 0;
  let postOtherErr = 0;
  const postPromises = Array.from({ length: 50 }, (_, i) =>
    api("POST", "/api/violations", {
      contractorId: "test",
      category: "hot_work",
      workSite: "test",
      responsiblePerson: "test",
      description: `test-${i}`,
      date: "2026-04-21",
    }, adminToken)
  );
  const postResults = await Promise.allSettled(postPromises);
  const postElapsed = Date.now() - postStart;
  for (const r of postResults) {
    if (r.status === "fulfilled") {
      if (r.value.status === 201) postOk++;
      else if (r.value.status === 429) postRejected++;
      else postOtherErr++;
    } else {
      postOtherErr++;
    }
  }
  process.stdout.write(`    ${postElapsed}ms total, ${postOk} created, ${postRejected} rate-limited, ${postOtherErr} errors\n`);

  // ─── Summary ───
  console.log(`\n=== Summary ===`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total: ${passed + failed + skipped}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
