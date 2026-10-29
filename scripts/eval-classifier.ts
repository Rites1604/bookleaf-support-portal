/**
 * Runs the brief's sample queries through the live classifier and reports accuracy.
 * Usage: npm run eval:classifier   (needs ANTHROPIC_API_KEY; costs well under $0.01)
 */
import { classifyTicket } from "../src/server/ai/classifier";
import { PRIORITY_RANK } from "../src/lib/domain";
import { SAMPLE_QUERIES } from "../tests/samples";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY to run the live eval.");
    process.exit(1);
  }
  let categoryHits = 0;
  let priorityHits = 0;
  for (const q of SAMPLE_QUERIES) {
    const r = await classifyTicket({ subject: q.text.slice(0, 60), description: q.text });
    const catOk = r.result.category === q.category;
    const priOk = PRIORITY_RANK[r.result.priority] <= PRIORITY_RANK[q.minPriority];
    categoryHits += Number(catOk);
    priorityHits += Number(priOk);
    console.log(
      `${catOk ? "✓" : "✗"} ${priOk ? "✓" : "✗"} [${r.source}] ${r.result.category} / ${r.result.priority} (${r.result.confidence.toFixed(2)})  ${q.text.slice(0, 70)}`,
    );
  }
  const n = SAMPLE_QUERIES.length;
  console.log(`\nCategory accuracy: ${categoryHits}/${n}   Priority at or above expected: ${priorityHits}/${n}`);
}

main().then(() => process.exit(0));
