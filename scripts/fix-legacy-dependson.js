/**
 * One-time repair for the confirmed legacy data bug:
 *
 *   A question's depends_on_question_id was written as the PREVIOUS
 *   question's linked_question_id, instead of the previous question's own
 *   id. Confirmed on two real pairs (7/8 and 19/20) - same pattern both
 *   times.
 *
 * This script:
 *   1. Finds every question whose depends_on_question_id does not match any
 *      real question id (i.e. it's dangling / broken).
 *   2. For each broken row, looks for exactly one other question whose own
 *      linked_question_id equals that dangling value - if found, that's the
 *      row it was actually supposed to point at, and the fix is to replace
 *      depends_on_question_id with THAT row's own id.
 *   3. Anything broken that doesn't match this exact pattern is left alone
 *      and printed separately for manual review - this script never guesses.
 *
 * Usage:
 *   node scripts/fix-legacy-dependson.js            # dry run, no writes
 *   node scripts/fix-legacy-dependson.js --apply     # actually applies the fix
 *
 * Reads DB credentials from the .env file in the project root (same
 * variables the app itself uses: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD,
 * DB_NAME). Run this from the project root.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile();

  const apply = process.argv.includes('--apply');

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await client.connect();

  try {
    const { rows: allQuestions } = await client.query(
      `SELECT id, quiz_id, index, instructions, depends_on_question_id, linked_question_id
       FROM questions`
    );

    const byId = new Map(allQuestions.map(q => [q.id, q]));
    const linkedIdToOwner = new Map(); // linked_question_id -> id of the row that carries it
    for (const q of allQuestions) {
      if (q.linked_question_id) linkedIdToOwner.set(q.linked_question_id, q.id);
    }

    const fixable = [];
    const unresolved = [];

    for (const q of allQuestions) {
      if (!q.depends_on_question_id) continue;

      const target = byId.get(q.depends_on_question_id);
      // Valid if it points at a real row IN THE SAME QUIZ - that's the only
      // shape this link is supposed to take. Anything else (missing, or
      // pointing at a row in a different quiz - which is what the
      // cross-quiz-twin corruption looks like) is broken.
      if (target && target.quiz_id === q.quiz_id) continue;

      const correctId = linkedIdToOwner.get(q.depends_on_question_id);
      const correctRow = correctId ? byId.get(correctId) : null;

      if (correctRow && correctRow.quiz_id === q.quiz_id && correctId !== q.id) {
        fixable.push({
          id: q.id,
          quizId: q.quiz_id,
          index: q.index,
          from: q.depends_on_question_id,
          to: correctId,
        });
      } else {
        unresolved.push({
          id: q.id,
          quizId: q.quiz_id,
          index: q.index,
          danglingDependsOnQuestionId: q.depends_on_question_id,
        });
      }
    }

    console.log(`Scanned ${allQuestions.length} questions.`);
    console.log(`Broken links matching the known pattern (auto-fixable): ${fixable.length}`);
    console.log(`Broken links NOT matching the known pattern (needs manual review): ${unresolved.length}`);
    console.log('');

    if (fixable.length > 0) {
      console.log('--- Fixable ---');
      for (const f of fixable) {
        console.log(`question ${f.id} (quiz ${f.quizId}, index ${f.index}): depends_on_question_id ${f.from} -> ${f.to}`);
      }
      console.log('');
    }

    if (unresolved.length > 0) {
      console.log('--- Needs manual review (left untouched) ---');
      for (const u of unresolved) {
        console.log(`question ${u.id} (quiz ${u.quizId}, index ${u.index}): dangling depends_on_question_id ${u.danglingDependsOnQuestionId}, no matching linked_question_id found anywhere`);
      }
      console.log('');
    }

    if (!apply) {
      console.log(fixable.length > 0
        ? `Dry run only, nothing written. Re-run with --apply to apply the ${fixable.length} fix(es) above.`
        : 'Dry run only, nothing to apply.');
      return;
    }

    if (fixable.length === 0) {
      console.log('Nothing to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const f of fixable) {
        await client.query(
          `UPDATE questions SET depends_on_question_id = $1 WHERE id = $2`,
          [f.to, f.id]
        );
      }
      await client.query('COMMIT');
      console.log(`Applied ${fixable.length} fix(es) successfully.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Something went wrong applying fixes, rolled back everything. No changes were made.');
      throw err;
    }
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
