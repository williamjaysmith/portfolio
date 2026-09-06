import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * 007 T015 — the accessibility sweep (FR-723, R709).
 *
 * Serious and critical violations fail; minor and moderate are printed and
 * attached to the report so they are known without being a gate. That is the
 * band the constitution's §III actually promises — a name, a role, a state and
 * a reachable target — and holding the gate there keeps it honest.
 */

const FAILS_ON = new Set(["serious", "critical"]);

interface Finding {
  id: string;
  impact: string;
  help: string;
  nodes: string[];
}

function findingsOf(violations: { id: string; impact?: string | null; help: string; nodes: { target: unknown[] }[] }[]): Finding[] {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "unknown",
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

function describe(findings: Finding[]): string {
  return findings.map((f) => `${f.impact} · ${f.id} — ${f.help}\n    ${f.nodes.join("\n    ")}`).join("\n");
}

/** Scans the current page and fails on anything serious or critical. */
export async function expectNoSeriousViolations(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const findings = findingsOf(results.violations);
  if (findings.length > 0) {
    await testInfo.attach(`axe · ${label}`, { body: describe(findings), contentType: "text/plain" });
  }
  const blocking = findings.filter((finding) => FAILS_ON.has(finding.impact));
  expect(blocking, `${label} has serious or critical accessibility violations:\n${describe(blocking)}`).toEqual([]);
}
