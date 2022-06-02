#!/usr/bin/env node

import { epicfail } from "epicfail"
import yargs from "yargs"
import { pbd } from "./commands/pbd.js"
import { stream } from "./commands/stream.js"
import { watch } from "./commands/watch.js"

epicfail(import.meta.url)

yargs(process.argv.slice(2))
  .scriptName("masterchat")
  .command(stream)
  .command(watch)
  .command(pbd)
  .demandCommand(1)
  .alias("h", "help").argv
