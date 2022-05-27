#!/usr/bin/env node

import yargs from "yargs"
import print from "./commands/print"
import watch from "./commands/watch"
import pbd from "./commands/pbd"
import { epicfail } from "epicfail"

epicfail(require.main?.filename!)

yargs(process.argv.slice(2))
  .scriptName("masterchat")
  .command(print)
  .command(watch)
  .command(pbd)
  .demandCommand(1)
  .alias("h", "help").argv
