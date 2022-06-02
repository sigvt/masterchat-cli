import { logAndExit } from "epicfail";
import { Action, Masterchat, stringify, toVideoId } from "masterchat";
import fs from "node:fs/promises";
import { VM, VMScript } from "vm2";
import { Arguments, CommandModule } from "yargs";
import { ChatHistory } from "../module/history.js";
import { stringifyAction } from "../module/term.js";

interface Args {
  videoId: string;
  channelId?: string;
  type: string;
  mode: "live" | "replay" | undefined;
  filter?: string;
  name: boolean;
  mods: boolean;
  collect: boolean;
  verbose: boolean;
}

function compileFilter(
  rule: string | undefined
): ((args: any) => boolean) | undefined {
  if (!rule) {
    return undefined;
  }

  const compiledRule = new VMScript(rule).compile();

  return (args: any) => {
    return new VM({
      sandbox: args,
      eval: false,
      wasm: false,
    }).run(compiledRule);
  };
}

async function handler(argv: Arguments<Args>) {
  process.on("SIGINT", () => {
    process.exit(0);
  });

  const videoId: string | undefined = toVideoId(argv.videoId);
  if (!videoId) {
    logAndExit(`Invalid videoId: ${argv.video}`);
  }

  const chanelId = argv.channelId;
  const mode = argv.mode;
  const verbose: boolean = argv.verbose;
  const showModeration: boolean = argv.mods;
  const showAuthor: boolean = argv.name;
  const collectionMode: boolean = argv.collect;
  const topChat = (argv.type as "top" | "all") === "top";
  const filterExp: string = Array.isArray(argv.filter)
    ? argv.filter[0]
    : argv.filter;

  const filter = compileFilter(filterExp);
  const history = new ChatHistory();
  const mc = chanelId
    ? new Masterchat(videoId, chanelId, { mode })
    : await Masterchat.init(videoId, { mode });

  const allowedActions = ["addChatItemAction", "addSuperChatItemAction"];
  if (showModeration) {
    allowedActions.push(
      "markChatItemsByAuthorAsDeletedAction",
      "markChatItemAsDeletedAction"
    );
  }

  if (mc.title) console.log("title:", mc.title);
  console.log(`mode: ${mc.isLive ? "live" : "replay"}`);
  console.log(`type: ${argv.type}`);
  console.log("-----------------");

  // Mimic live chat
  const queue: string[] = [];
  let wait = 0;

  new Promise(async () => {
    while (true) {
      const timeout = Math.ceil(wait / (queue.length + 1)) || 0;
      await new Promise((resolve) => setTimeout(resolve, timeout));
      wait = Math.max(0, wait - timeout);
      if (queue.length > 0) {
        console.log(queue.shift());
      }
    }
  });

  // Poll chats
  for await (const response of mc.iterate({ topChat })) {
    const { actions, continuation } = response;
    const delay = continuation?.timeoutMs || 0;

    if (verbose) {
      console.log("incoming actions:", actions.length, "delay:", delay);
    }

    if (actions.length === 0) continue;

    const filteredActions = !filter
      ? actions
      : actions.filter((action) => {
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
          };
          return filter(filterContext);
        });

    const actionsToQueue = await Promise.all(
      filteredActions
        .filter((action) => allowedActions.includes(action.type))
        .map((action) =>
          stringifyAction(action, {
            history,
            showAuthor,
          })
        )
    );

    queue.push(...actionsToQueue);

    if (collectionMode) {
      let groupedActions = {} as Record<string, Action[]>;
      for (const action of actions) {
        const type = action.type;
        if (!groupedActions[type]) groupedActions[type] = [];
        groupedActions[type].push(action);
      }
      await Promise.all(
        Object.entries(groupedActions).map(([type, actions]) => {
          const payload =
            actions.map((action) => JSON.stringify(action)).join("\n") + "\n";
          return fs.appendFile(`${type}.jsonl`, payload);
        })
      );
    }

    wait += delay || 0;
  }

  process.exit(0);
}

export const stream: CommandModule<{}, Args> = {
  command: "stream <videoId> [channelId]",
  aliases: ["s"],
  describe: "TUI for YouTube live chat",
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
      describe: "Chat mode",
      alias: "m",
      default: undefined,
      choices: ["live", "replay"],
    },
    filter: {
      describe: "Filter rule",
      alias: "f",
      type: "string",
    },
    name: {
      describe: "Show author name",
      alias: "n",
      type: "boolean",
      default: false,
    },
    mods: {
      describe: "Show moderation events",
      alias: "x",
      type: "boolean",
      default: false,
    },
    collect: {
      describe: "Save received actions as JSONLines (.jsonl)",
      alias: "c",
      type: "boolean",
      default: false,
    },
    verbose: {
      describe: "Show additional info",
      alias: "v",
      default: false,
      type: "boolean",
    },
  },
};
