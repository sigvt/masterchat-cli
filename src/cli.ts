#!/usr/bin/env node

import yargs from "yargs"
import live from "./commands/live"
import events from "./commands/events"
import pbd from "./commands/pbd"
import { epicfail } from "epicfail"

epicfail(require.main?.filename!)

yargs(process.argv.slice(2))
  .scriptName("masterchat")
  .command(live)
  .command(events)
  .command(pbd)
  .demandCommand(1)
  .alias("h", "help").argv
