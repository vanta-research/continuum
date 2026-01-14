/**
 * Tests for surgical edit parsing
 * Run with: npx tsx lib/surgical-edit.test.ts
 */

import {
  parseSurgicalEdits,
  containsSurgicalEdits,
  applySurgicalEdits,
  SURGICAL_EDIT_START,
  SURGICAL_EDIT_END,
} from "./surgical-edit";

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message || "Assertion failed"}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`,
    );
  }
}

function assertTrue(value: boolean, message?: string) {
  if (!value) {
    throw new Error(message || "Expected true but got false");
  }
}

// Tests for complete surgical edit blocks
console.log("\n=== Complete Surgical Edit Blocks ===\n");

test("parses single replace operation", () => {
  const output = `${SURGICAL_EDIT_START}
{
  "operation": "replace",
  "startLine": 10,
  "endLine": 15,
  "content": "new content here"
}
${SURGICAL_EDIT_END}`;

  const edits = parseSurgicalEdits(output);
  assertEqual(edits.length, 1);
  assertEqual(edits[0].operation, "replace");
  assertEqual(edits[0].startLine, 10);
  assertEqual(edits[0].endLine, 15);
  assertEqual(edits[0].content, "new content here");
});

test("parses array of operations", () => {
  const output = `${SURGICAL_EDIT_START}
[
  {"operation": "replace", "startLine": 10, "endLine": 12, "content": "new text"},
  {"operation": "insert", "startLine": 25, "content": "inserted line"},
  {"operation": "delete", "startLine": 30, "endLine": 32}
]
${SURGICAL_EDIT_END}`;

  const edits = parseSurgicalEdits(output);
  assertEqual(edits.length, 3);
  assertEqual(edits[0].operation, "replace");
  assertEqual(edits[1].operation, "insert");
  assertEqual(edits[2].operation, "delete");
});

test("parses content with escaped newlines", () => {
  const output = `${SURGICAL_EDIT_START}
{
  "operation": "replace",
  "startLine": 1,
  "endLine": 3,
  "content": "line one\\nline two\\nline three"
}
${SURGICAL_EDIT_END}`;

  const edits = parseSurgicalEdits(output);
  assertEqual(edits.length, 1);
  assertEqual(edits[0].content, "line one\nline two\nline three");
});

test("parses content with escaped quotes", () => {
  const output = `${SURGICAL_EDIT_START}
{
  "operation": "replace",
  "startLine": 1,
  "endLine": 1,
  "content": "She said \\"hello\\""
}
${SURGICAL_EDIT_END}`;

  const edits = parseSurgicalEdits(output);
  assertEqual(edits.length, 1);
  assertEqual(edits[0].content, 'She said "hello"');
});

// Tests for incomplete surgical edit blocks (missing closing marker)
console.log("\n=== Incomplete Surgical Edit Blocks ===\n");

test("containsSurgicalEdits returns true for incomplete block with JSON", () => {
  const output = `${SURGICAL_EDIT_START}
{
  "operation": "replace",
  "startLine": 90,
  "endLine": 105,
  "content": "some content here"
}`;

  assertTrue(
    containsSurgicalEdits(output),
    "Should detect incomplete surgical edit block",
  );
});

test("parses incomplete single object (missing closing marker)", () => {
  const output = `${SURGICAL_EDIT_START}
{
  "operation": "replace",
  "startLine": 90,
  "endLine": 105,
  "content": "The new content goes here"
}`;

  const edits = parseSurgicalEdits(output);
  assertEqual(edits.length, 1);
  assertEqual(edits[0].operation, "replace");
  assertEqual(edits[0].startLine, 90);
  assertEqual(edits[0].endLine, 105);
});

test("parses incomplete array (missing closing marker)", () => {
  const output = `${SURGICAL_EDIT_START}
[
  {
    "operation": "replace",
    "startLine": 90,
    "endLine": 105,
    "content": "First edit content"
  },
  {
    "operation": "insert",
    "startLine": 106,
    "content": "Second edit content"
  }
]`;

  const edits = parseSurgicalEdits(output);
  assertEqual(edits.length, 2);
  assertEqual(edits[0].operation, "replace");
  assertEqual(edits[0].startLine, 90);
  assertEqual(edits[1].operation, "insert");
  assertEqual(edits[1].startLine, 106);
});

test("parses real-world incomplete output from user", () => {
  const output = `${SURGICAL_EDIT_START}
[
  {
    "operation": "replace",
    "startLine": 90,
    "endLine": 105,
    "content": "The observatory's logs revealed the horrifying truth. The signal hadn't just arrived decades earlier—it had been *growing*."
  },
  {
    "operation": "insert",
    "startLine": 106,
    "content": "\\n\\n---\\n\\n## SEGMENT 5: THE VESSEL\\n\\nThe Arctic wind howled like a living thing."
  }
]`;

  const edits = parseSurgicalEdits(output);
  assertEqual(edits.length, 2);
  assertEqual(edits[0].operation, "replace");
  assertEqual(edits[0].startLine, 90);
  assertEqual(edits[0].endLine, 105);
  assertEqual(edits[1].operation, "insert");
  assertEqual(edits[1].startLine, 106);
  assertTrue(
    edits[1].content?.includes("SEGMENT 5"),
    "Content should include SEGMENT 5",
  );
});

// Tests for containsSurgicalEdits
console.log("\n=== containsSurgicalEdits Detection ===\n");

test("returns false for output without markers", () => {
  assertTrue(
    !containsSurgicalEdits("Just some regular text"),
    "Should return false for regular text",
  );
});

test("returns true for complete block", () => {
  const output = `${SURGICAL_EDIT_START}{"operation": "delete", "startLine": 1, "endLine": 2}${SURGICAL_EDIT_END}`;
  assertTrue(containsSurgicalEdits(output), "Should detect complete block");
});

test("returns false for start marker without JSON", () => {
  const output = `${SURGICAL_EDIT_START} some random text`;
  assertTrue(
    !containsSurgicalEdits(output),
    "Should return false for non-JSON after marker",
  );
});

// Tests for applySurgicalEdits
console.log("\n=== applySurgicalEdits ===\n");

test("applies replace operation", () => {
  const doc = "line 1\nline 2\nline 3\nline 4\nline 5";
  const edits = [
    { operation: "replace" as const, startLine: 2, endLine: 3, content: "new line 2\nnew line 3" },
  ];

  const result = applySurgicalEdits(doc, edits);
  assertTrue(result.success);
  assertEqual(result.appliedEdits, 1);
  assertEqual(result.newContent, "line 1\nnew line 2\nnew line 3\nline 4\nline 5");
});

test("applies insert operation", () => {
  const doc = "line 1\nline 2\nline 3";
  const edits = [
    { operation: "insert" as const, startLine: 2, content: "inserted" },
  ];

  const result = applySurgicalEdits(doc, edits);
  assertTrue(result.success);
  assertEqual(result.newContent, "line 1\ninserted\nline 2\nline 3");
});

test("applies delete operation", () => {
  const doc = "line 1\nline 2\nline 3\nline 4";
  const edits = [
    { operation: "delete" as const, startLine: 2, endLine: 3 },
  ];

  const result = applySurgicalEdits(doc, edits);
  assertTrue(result.success);
  assertEqual(result.newContent, "line 1\nline 4");
});

test("applies multiple operations in reverse order", () => {
  const doc = "line 1\nline 2\nline 3\nline 4\nline 5";
  const edits = [
    { operation: "replace" as const, startLine: 2, endLine: 2, content: "replaced 2" },
    { operation: "delete" as const, startLine: 4, endLine: 4 },
  ];

  const result = applySurgicalEdits(doc, edits);
  assertTrue(result.success);
  assertEqual(result.appliedEdits, 2);
  assertEqual(result.newContent, "line 1\nreplaced 2\nline 3\nline 5");
});

// Summary
console.log("\n=== Summary ===\n");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
