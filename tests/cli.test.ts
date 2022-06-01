import { execa } from "execa"

it("can run", async () => {
  const res = await execa("node", ["./dist/cli.js", "--help"])
  expect(res.stdout).toContain("Commands:")
})
