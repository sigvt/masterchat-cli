import chalk from "chalk"
import fetch from "cross-fetch"
import { logAndExit } from "epicfail"
import LRU from "lru-cache"
import { Action, Masterchat, stringify, toVideoId, YTRun } from "masterchat"
import fs from "node:fs/promises"
import { VM, VMScript } from "vm2"
import { Arguments, CommandModule } from "yargs"
import { chalkSc } from "../lib/printer.js"

const imageCache = new LRU({ max: 500 })

interface Args {
  videoId: string
  channelId?: string
  verbose: boolean
  type: string
  mode: "live" | "replay" | undefined
  filter?: string
  mods: boolean
  author: boolean
  collect: boolean
}

function toBuffer(ab: ArrayBuffer) {
  const buf = Buffer.alloc(ab.byteLength)
  const view = new Uint8Array(ab)
  for (let i = 0; i < buf.length; ++i) {
    buf[i] = view[i]
  }
  return buf
}

function isiTerm() {
  return process.env.TERM_PROGRAM === "iTerm.app"
}

async function toInlineImage(url: string) {
  const cached = imageCache.get<string>(url)
  if (cached) return cached

  const buf = toBuffer(await fetch(url).then((res) => res.arrayBuffer()))
  const content = buf.toString("base64")
  const args = {
    size: buf.byteLength,
    inline: 1,
    height: 1,
    // width: "auto",
    // preserveAspectRatio: 1,
  }
  const argsString = Object.entries(args)
    .map(([k, v]) => `${k}=${v}`)
    .join(";")
  const ansiString = `\u001B]1337;File=${argsString}:${content}\u0007`
  imageCache.set(url, ansiString)

  return ansiString
}

async function termify(msg: YTRun[]): Promise<string> {
  let res = ""

  for (const run of msg) {
    if ("text" in run) {
      res += run.text
    } else if ("emoji" in run) {
      const { emoji } = run
      if (!emoji.isCustomEmoji) {
        res += emoji.emojiId
      } else {
        const shortcut = emoji.shortcuts[emoji.shortcuts.length - 1]
        const url =
          emoji.image.thumbnails[emoji.image.thumbnails.length - 1].url
        res += isiTerm() ? await toInlineImage(url) : shortcut
      }
    }
  }

  return res
}

export async function stringifyActions(
  actions: Action[],
  {
    ignoreModerationEvents = true,
    showAuthor = true,
  }: { ignoreModerationEvents?: boolean; showAuthor?: boolean } = {}
): Promise<string[]> {
  const simpleChat: string[] = []

  for (const action of actions) {
    switch (action.type) {
      case "addSuperChatItemAction": {
        let text = ""

        if (showAuthor) {
          if (isiTerm()) {
            text += await toInlineImage(action.authorPhoto)
            text += " "
          }
          text += chalk.gray(action.authorName)
          text += ": "
        }

        text += action.message
          ? await termify(action.message)
          : "<empty message>"

        text += ` (${action.amount} ${action.currency})`

        simpleChat.push(chalkSc(action.color)(text))
        break
      }
      case "addChatItemAction": {
        let text = ""

        if (showAuthor) {
          const colorize = action.membership ? chalk.green : chalk.gray
          const badges = []

          if (action.isModerator) {
            badges.push("🛠")
          }

          if (action.isVerified) {
            badges.push("✅")
          }

          if (action.isOwner) {
            badges.push("⚡️")
          }

          if (isiTerm()) {
            text += await toInlineImage(action.authorPhoto)
            text += " "
          }

          text += colorize(action.authorName)

          if (badges.length >= 1) {
            text += "( " + badges.join(" ") + " )"
          }

          text += ": "
        }

        text += await termify(action.message!)

        simpleChat.push(text)
        break
      }
      case "markChatItemsByAuthorAsDeletedAction": {
        if (!ignoreModerationEvents) {
          simpleChat.push(chalk.red(`[banned]: ${action.channelId}`))
        }
        break
      }
      case "markChatItemAsDeletedAction": {
        if (!ignoreModerationEvents) {
          simpleChat.push(
            chalk.yellow(
              `${action.retracted ? "[retracted]" : "[deleted]"}: ${
                action.targetId
              }`
            )
          )
        }
        break
      }
    }
  }
  return simpleChat
}

function compileFilter(
  rule: string | undefined
): ((args: any) => boolean) | undefined {
  if (!rule) {
    return undefined
  }

  const compiledRule = new VMScript(rule).compile()

  return (args: any) => {
    return new VM({
      sandbox: args,
      eval: false,
      wasm: false,
    }).run(compiledRule)
  }
}

async function handler(argv: Arguments<Args>) {
  process.on("SIGINT", () => {
    process.exit(0)
  })

  const videoId: string | undefined = toVideoId(argv.videoId)
  if (!videoId) {
    logAndExit(`Invalid videoId: ${argv.video}`)
  }

  const chanelId = argv.channelId

  const mode = argv.mode
  const verbose: boolean = argv.verbose
  const showModeration: boolean = argv.mods
  const showAuthor: boolean = argv.author
  const collectionMode: boolean = argv.collect
  const topChat = (argv.type as "top" | "all") === "top"
  const filterExp: string = Array.isArray(argv.filter)
    ? argv.filter[0]
    : argv.filter
  const filter = compileFilter(filterExp)

  const mc = chanelId
    ? new Masterchat(videoId, chanelId, { mode })
    : await Masterchat.init(videoId, { mode })

  if (mc.title) console.log("title:", mc.title)
  console.log(`mode: ${mc.isLive ? "live" : "replay"}`)
  console.log("-----------------")

  let chatQueue: string[] = []
  let wait = 0

  new Promise(async () => {
    while (true) {
      const timeout = Math.ceil(wait / (chatQueue.length + 1)) || 0
      await new Promise((resolve) => setTimeout(resolve, timeout))
      wait = Math.max(0, wait - timeout)
      if (chatQueue.length > 0) {
        console.log(chatQueue.shift())
      }
    }
  })

  for await (const response of mc.iterate({ topChat })) {
    const { actions, continuation } = response
    const delay = continuation?.timeoutMs || 0

    if (verbose) {
      console.log("incoming actions:", actions.length, "delay:", delay)
    }

    if (collectionMode) {
      let groupedActions = {} as Record<string, Action[]>
      for (const action of actions) {
        const type = action.type
        if (!groupedActions[type]) groupedActions[type] = []
        groupedActions[type].push(action)
      }
      await Promise.all(
        Object.entries(groupedActions).map(([type, actions]) => {
          const payload =
            actions.map((action) => JSON.stringify(action)).join("\n") + "\n"
          return fs.appendFile(`${type}.jsonl`, payload)
        })
      )
    }

    if (actions.length > 0) {
      let aggregatedActions = actions

      if (filter) {
        aggregatedActions = aggregatedActions.filter((action) => {
          const filterContext = {
            ...action,
            isSuperchat: action.type === "addSuperChatItemAction",
            isMember:
              action.type === "addChatItemAction" &&
              action.membership !== undefined,
            message:
              "message" in action && action.message
                ? stringify(action.message, { spaces: true })
                : "",
          }
          return filter(filterContext)
        })
      }

      const chat: string[] = await stringifyActions(aggregatedActions, {
        ignoreModerationEvents: !showModeration,
        showAuthor,
      })

      if (chat.length > 0) {
        chatQueue = [...chatQueue, ...chat]
      }

      wait += delay || 0
    }
  }

  process.exit(0)
}

const commandModule: CommandModule<{}, Args> = {
  command: "print <videoId> [channelId]",
  describe: "Print live chat events",
  handler,
  builder: {
    videoId: {
      desc: "Video ID or URL",
      type: "string",
    },
    channelId: {
      desc: "Channel ID",
      type: "string",
    },
    type: {
      describe: "Chat type",
      alias: "t",
      default: "top",
      choices: ["top", "all"],
    },
    mode: {
      describe: "Live chat mode",
      alias: "m",
      default: undefined,
      choices: ["live", "replay"],
    },
    filter: {
      describe: "Filter rule",
      alias: "f",
      type: "string",
    },
    author: {
      describe: "Print author name",
      alias: "a",
      type: "boolean",
      default: false,
    },
    mods: {
      describe: "Print moderation events",
      type: "boolean",
      default: false,
    },
    verbose: {
      describe: "Print additional info",
      alias: "v",
      default: false,
      type: "boolean",
    },
    collect: {
      describe: "Save received actions as JSONLines (.jsonl)",
      alias: "c",
      type: "boolean",
      default: false,
    },
  },
}

export default commandModule
