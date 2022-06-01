#!/usr/bin/env node

import yargs from "yargs"
import print from "./commands/print.js"
import watch from "./commands/watch.js"
import pbd from "./commands/pbd.js"
import { epicfail } from "epicfail"

epicfail(import.meta.url)

yargs(process.argv.slice(2))
  .scriptName("masterchat")
  .command(print)
  .command(watch)
  .command(pbd)
  .demandCommand(1)
  .alias("h", "help").argv
