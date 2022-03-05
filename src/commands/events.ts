import chalk from "chalk"
import { Masterchat, StreamPool } from "masterchat"
import { Arguments, CommandModule } from "yargs"
import { printData } from "../lib/printer"
import { ChatHistory } from "../lib/history"
import fetch from "cross-fetch"

interface Args {
  query?: string
  org?: string
  upcomingHours?: number
}

async function getStreams(
  org: string = "All Vtubers",
  upcomingHours: number = 4
) {
  const res = await fetch(
    `https://holodex.net/api/v2/live?org=${encodeURIComponent(
      org
    )}&max_upcoming_hours=${upcomingHours}`
  )
  const streams = (await res.json()) as any
  return streams
}

async function handlerMux(org?: string) {
  const history = new ChatHistory()
  const streams = new StreamPool({ mode: "live" })

  streams.on("data", (data, mc) =>
    printData({ data, history, prefix: mc.videoId, mc })
  )

  streams.on("end", (reason, { videoId }) =>
    console.log(
      chalk.bgBlue.black(`[ENDED] ${videoId}${reason ? `: ${reason}` : ""}`)
    )
  )

  streams.on("error", (err, { videoId }) =>
    console.error(chalk.bgRed.black(`[ERROR] ${videoId}`), err)
  )

  for (const stream of await getStreams(org)) {
    streams.subscribe(stream.id, stream.channel.id)
  }
}

async function handlerSingle(query: string) {
  if (!query) {
    throw new Error("missing videoId or URL")
  }

  const history = new ChatHistory()
  const mc = await Masterchat.init(query)

  const url = `https://youtu.be/${mc.videoId}`

  console.log(mc.title)
  console.log(mc.channelName)
  console.log(url)
  console.log("-----------------")

  mc.on("data", (data) => printData({ data, history, mc }))
  mc.on("error", (err) => console.log("[ERROR]", err, url))
  mc.on("end", (reason) => console.log("[END]", `reason=${reason}`, url))

  mc.listen()
}

async function handler(args: Arguments<Args>) {
  if (args.query) {
    handlerSingle(args.query)
  } else {
    handlerMux(args.org)
  }
}

const commandModule: CommandModule<{}, Args> = {
  command: "events",
  describe: "inspect events other than chats",
  builder: {
    query: {
      desc: "query",
    },
    org: {
      desc: "organization (for mux)",
      default: "All Vtubers",
    },
  },
  handler,
}

export default commandModule
