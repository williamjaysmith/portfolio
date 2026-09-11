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

/**
 * The one finding this sweep accepts, and the measurement behind it.
 *
 * A PAST event block is faded with `--fam-past-dim` (FR-215), and the fade takes
 * the title down with the fill. Measured across all twenty palette colours with
 * the ink `colors.ts` picks for each (FR-214), six of them clear 4.5:1 UNDIMMED
 * by between 0.04 and 0.36 — #CF632E at 4.54, #2D8086 and #408257 at 4.62,
 * #CB434C 4.72, #2178AF 4.81, #915EA1 4.86. So *any* opacity on the block drops
 * those six below 1.4.3, and no value of the token exists that both dims
 * visibly and holds AA. The alternatives were measured too and are worse:
 * fading the FILL toward the page instead destroys the six white-ink colours
 * outright, and raising --fam-past-dim far enough to pass here also takes it
 * past the threshold that gives `--fam-reward-muted-ink` its whole reason to
 * exist (reward-tokens.test.ts asserts that boundary).
 *
 * So it is accepted, on the operator's explicit ruling for this app: *"we dont
 * actually need this app to be accessibility compliant, this is a personal use
 * app for my family."* A finished event is decoration of a decision already
 * made — the upcoming blocks, which are what anyone reads, are undimmed and
 * measured.
 *
 * **It is keyed on the token, not on the rule.** `color-contrast` anywhere else
 * still fails the gate; only nodes the stylesheet has explicitly dimmed with
 * this token are let through, so nothing new can hide behind it.
 */
const ACCEPTED_CONTRAST_NODE = "--fam-past-dim";

function isAcceptedPastEventFade(finding: Finding): boolean {
  return (
    finding.id === "color-contrast" &&
    finding.nodes.length > 0 &&
    finding.nodes.every((node) => node.includes(ACCEPTED_CONTRAST_NODE))
  );
}

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
  const blocking = findings.filter(
    (finding) => FAILS_ON.has(finding.impact) && !isAcceptedPastEventFade(finding),
  );
  expect(blocking, `${label} has serious or critical accessibility violations:\n${describe(blocking)}`).toEqual([]);
}
