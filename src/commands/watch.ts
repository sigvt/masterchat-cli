import chalk from "chalk"
import fetch from "cross-fetch"
import {
  AddChatItemAction,
  ChatResponse,
  Masterchat,
  StreamPool,
} from "masterchat"
import { Arguments, CommandModule } from "yargs"
import { ChatHistory } from "../module/history.js"
import { stringifyAction } from "../module/term.js"

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

export async function printChatResponse(
  data: ChatResponse,
  {
    history,
    mc,
    prefix,
    maxChats = 0,
    verbose = false,
    showTicker = false,
  }: {
    history: ChatHistory
    mc: Masterchat
    prefix?: string
    maxChats?: number
    verbose?: boolean
    showTicker?: boolean
  }
) {
  function log(...obj: any) {
    const lines = obj.join(" ").split("\n")
    for (const line of lines) {
      if (prefix) process.stdout.write(chalk.gray(prefix) + " ")
      console.log(line)
    }
  }

  const ignoredActions = [
    "addSuperChatTickerAction",
    "addSuperStickerTickerAction",
    "addMembershipTickerAction",
  ]

  const { actions, continuation } = data
  if (verbose) {
    log(
      "actions",
      actions.length,
      "timeoutMs",
      continuation?.timeoutMs,
      "now",
      new Date(),
      "next",
      continuation?.timeoutMs && new Date(Date.now() + continuation.timeoutMs)
    )
  }

  const chats = actions.filter(
    (action): action is AddChatItemAction => action.type === "addChatItemAction"
  )

  chats.forEach((chat) => {
    history.insert(chat, mc.channelId)
  })

  let chatCount = 0
  for (const action of actions) {
    if (ignoredActions.includes(action.type)) continue

    if (action.type === "addChatItemAction") {
      if (chatCount >= maxChats) continue
      chatCount += 1
    }

    log(await stringifyAction(action, { history, showAuthor: false }))
  }
}

async function handlerMux(org?: string) {
  const history = new ChatHistory()
  const streams = new StreamPool({ mode: "live" })

  streams.on("data", (data, mc) =>
    printChatResponse(data, { history, prefix: mc.videoId, mc })
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

  mc.on("data", (data) => printChatResponse(data, { history, mc }))
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

export const watch: CommandModule<{}, Args> = {
  command: "watch [videoId] [channelId]",
  describe: "Observe all events except live chat",
  builder: {
    videoId: {
      desc: "Video ID or URL",
    },
    channelId: {
      desc: "Channel ID",
    },
    org: {
      desc: "Organization name to watch (ignored if `videoId` is specified)",
      alias: "o",
      default: "All Vtubers",
    },
  },
  handler,
}
