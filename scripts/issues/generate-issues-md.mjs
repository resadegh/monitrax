/**
 * Generates docs/issues/ISSUES.md (human view) from ISSUES.json.
 * PURE NODE. Run: `npm run issues:generate`. Do NOT hand-edit ISSUES.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const REGISTRY = resolve(ROOT, 'docs/issues/ISSUES.json');
const OUT = resolve(ROOT, 'docs/issues/ISSUES.md');

const STATUS_ICON = { OPEN: '🔵', DIAGNOSED: '🟡', FIXING: '🟠', VERIFIED: '🟢', CLOSED: '✅', WONTFIX: '⚪', RETRACTED: '❌' };
const SEV_ICON = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

export function generateIssuesMd() {
  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const issues = reg.issues;
  const by = (s) => issues.filter((i) => i.status === s).length;
  const open = issues.filter((i) => !['CLOSED', 'WONTFIX', 'RETRACTED'].includes(i.status));

  let md = `# Issue Registry (generated — do not hand-edit)\n\n`;
  md += `> Generated from \`docs/issues/ISSUES.json\` by \`npm run issues:generate\`. Gated by \`npm run issues:check\`.\n`;
  md += `> Lifecycle: 🔵 OPEN → 🟡 DIAGNOSED → 🟠 FIXING → 🟢 VERIFIED → ✅ CLOSED. See \`docs/issues/README.md\`.\n\n`;
  md += `**${issues.length} total** · ${open.length} open · `;
  md += `🔵 ${by('OPEN')} · 🟡 ${by('DIAGNOSED')} · 🟠 ${by('FIXING')} · 🟢 ${by('VERIFIED')} · ✅ ${by('CLOSED')}\n\n`;

  md += `| ID | Status | Sev | Δ# | Title | Fix | Test |\n|---|---|---|---|---|---|---|\n`;
  for (const i of issues) {
    const fix = (i.fixPRs ?? []).map((p) => `#${p}`).join(', ') || '—';
    const test = i.test ? '✅' : i.changesNumbers ? '—' : 'n/a';
    md += `| ${i.id} | ${STATUS_ICON[i.status] ?? ''} ${i.status} | ${SEV_ICON[i.severity] ?? ''} | ${i.changesNumbers ? 'yes' : 'no'} | ${i.title} | ${fix} | ${test} |\n`;
  }

  md += `\n---\n\n`;
  for (const i of issues) {
    md += `### ${i.id} — ${i.title}\n\n`;
    md += `**${STATUS_ICON[i.status] ?? ''} ${i.status}** · ${SEV_ICON[i.severity] ?? ''} ${i.severity} · changes numbers: **${i.changesNumbers ? 'yes' : 'no'}** · area: ${i.area} · opened ${i.opened}${i.closed ? ` · closed ${i.closed}` : ''}\n\n`;
    if ((i.rootCause ?? []).length) md += `- **Root cause:** ${i.rootCause.map((r) => `\`${r}\``).join(', ')}\n`;
    if ((i.semanticKeys ?? []).length) md += `- **Neomatrix:** ${i.semanticKeys.map((k) => `\`${k}\``).join(', ')}\n`;
    if ((i.downstreamConsumers ?? []).length) md += `- **Downstream consumers (§19.4):** ${i.downstreamConsumers.map((c) => `\`${c}\``).join(', ')}\n`;
    if ((i.fixPRs ?? []).length) md += `- **Fix PR(s):** ${i.fixPRs.map((p) => `#${p}`).join(', ')}\n`;
    md += `- **Holistic test (§19.4):** ${i.test ? `\`${i.test}\`` : i.changesNumbers ? '⚠ required before VERIFIED/CLOSED' : 'n/a (display/UX)'}\n`;
    if (i.tracker) md += `- **Detail:** \`${i.tracker}\`\n`;
    if (i.notes) md += `\n${i.notes}\n`;
    md += `\n`;
  }

  writeFileSync(OUT, md);
  return { count: issues.length, out: OUT };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { count, out } = generateIssuesMd();
  console.log(`✓ Wrote ${out} (${count} issues).`);
}
