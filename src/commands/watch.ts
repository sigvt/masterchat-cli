import chalk from "chalk"
import { Masterchat, StreamPool } from "masterchat"
import { Arguments, CommandModule } from "yargs"
import { printData } from "../lib/printer.js"
import { ChatHistory } from "../lib/history.js"
import fetch from "cross-fetch"

interface Args {
  videoId?: string
  channelId?: string
  org?: string
  upcomingHours?: number
}

async function getStreams(
  org: string = "All Vtubers",
  upcomingHours: number = 1
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

async function handlerSingle(videoId: string, channelId?: string) {
  const history = new ChatHistory()

  const mc = channelId
    ? new Masterchat(videoId, channelId)
    : await Masterchat.init(videoId)

  const url = `https://youtu.be/${mc.videoId}`

  if (mc.title) console.log(mc.title)
  if (mc.channelName) console.log(mc.channelName)
  console.log(url, `(${mc.isLive ? "live" : "replay"})`)
  console.log("-----------------")

  mc.on("data", (data) => printData({ data, history, mc }))
  mc.on("error", (err) => console.log("[ERROR]", err, url))
  mc.on("end", (reason) => console.log("[END]", `reason=${reason}`, url))

  mc.listen()
}

async function handler(args: Arguments<Args>) {
  if (args.videoId) {
    handlerSingle(args.videoId, args.channelId)
  } else {
    handlerMux(args.org)
  }
}

const commandModule: CommandModule<{}, Args> = {
  command: "watch [videoId] [channelId]",
  describe: "Pretty-print all events except live chat",
  builder: {
    videoId: {
      desc: "Video ID or URL",
    },
    channelId: {
      desc: "Channel id",
    },
    org: {
      desc: "Organization name to watch (ignored if `videoId` is provided)",
      default: "All Vtubers",
    },
  },
  handler,
}

export default commandModule
