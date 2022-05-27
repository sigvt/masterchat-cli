import chalk from "chalk"
import { logAndExit } from "epicfail"
import { Action, Masterchat, stringify, toVideoId } from "masterchat"
import fs from "node:fs/promises"
import { VM, VMScript } from "vm2"
import { Arguments, CommandModule } from "yargs"

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

export function stringifyActions(
  actions: Action[],
  {
    ignoreModerationEvents = true,
    showAuthor = true,
  }: { ignoreModerationEvents?: boolean; showAuthor?: boolean } = {}
): string[] {
  const simpleChat: string[] = []

  for (const action of actions) {
    switch (action.type) {
      case "addSuperChatItemAction": {
        let text = ""

        if (showAuthor) {
          text += chalk.gray(action.authorName)
          text += ": "
        }

        text += action.message
          ? stringify(action.message, { spaces: true })
          : "<empty message>"

        text += ` (${action.amount} ${action.currency})`

        simpleChat.push(text)
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

          text += colorize(action.authorName)

          if (badges.length >= 1) {
            text += "( " + badges.join(" ") + " )"
          }

          text += ": "
        }

        text += stringify(action.message!, { spaces: true })

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

      const chat: string[] = stringifyActions(aggregatedActions, {
        ignoreModerationEvents: !showModeration,
        showAuthor,
      })

      if (chat.length > 0) {
        chatQueue = [...chatQueue, ...chat]
      }

      wait += delay || 0
    }
  }

  console.log("Live stream has ended")
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
