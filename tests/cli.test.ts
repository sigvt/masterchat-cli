import { execa } from "execa";
import { expect, test } from "vitest";

test("can run", async () => {
  const res = await execa("node", ["./dist/cli.js", "--help"]);
  expect(res.stdout).toContain("Commands:");
});
