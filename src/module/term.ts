import chalk from "chalk"
import fetch from "cross-fetch"
import LRU from "lru-cache"
import { Action, formatColor, stringify, SuperChat, YTRun } from "masterchat"
import { ChatHistory } from "./history.js"

const imageCache = new LRU({ max: 500 })

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

export function chalkSc(color: SuperChat["color"]) {
  switch (color) {
    case "blue":
      return chalk.bgBlue.black
    case "green":
      return chalk.bgGreen.black
    case "lightblue":
      return chalk.bgBlueBright.black
    case "magenta":
      return chalk.bgMagenta.black
    case "orange":
      return chalk.bgYellowBright.black
    case "red":
      return chalk.bgRed.black
    case "yellow":
      return chalk.bgYellow.black
  }
}

export async function stringifyAction(
  action: Action,
  { history, showAuthor }: { history: ChatHistory; showAuthor: boolean }
): Promise<string> {
  switch (action.type) {
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

      return text
    }
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

      text += chalk.bold(`[${action.amount} ${action.currency}] `)

      text += action.message ? await termify(action.message) : "<empty message>"

      return chalkSc(action.color)(text)
    }
    case "addSuperStickerItemAction": {
      return chalk.yellow(
        `[super sticker] ${stringify(action.authorName)}: ${action.stickerText}`
      )
    }
    case "addMembershipItemAction": {
      return chalk.green(
        `[membership joined] Welcome${
          action.level ? ` ${action.level},` : ""
        } ${action.authorName} !: ${action.membership?.status ?? "No status"} ${
          action.membership?.since ?? ""
        }`
      )
    }
    case "addMembershipMilestoneItemAction": {
      return chalk.green(
        `[milestone ${action.authorName} (${
          action.membership?.status ?? "No status"
        } ${action.membership?.since ?? ""})] Member${
          action.level ? ` of ${action.level}` : ""
        } for ${action.durationText} (${action.duration}): ${
          action.message ? stringify(action.message) : "<empty message>"
        }`
      )
    }
    case "membershipGiftPurchaseAction": {
      return chalk.green(
        `[membership gift purchase] ${action.authorName} (${
          action.membership.status
        } ${action.membership.since ?? ""}) gifted ${
          action.amount
        } memberships for ${action.channelName}`
      )
    }
    case "membershipGiftRedemptionAction": {
      return chalk.green(
        `[membership gift redemption] ${action.authorName} was gifted a membership by ${action.senderName}`
      )
    }
    case "addPlaceholderItemAction": {
      const id = action.id
      const target = history.findOne(id)?.msg
      return chalk.blue(
        `[placeholder]${target ? " " + target : ""} ${chalk.gray(action.id)}`
      )
    }
    case "replaceChatItemAction": {
      const id = action.targetItemId
      const item = action.replacementItem
      const itemType = Object.keys(item)[0]
      // const target = history.findOne(id)?.msg;
      return chalk.blue(`[replace] ${id} → ${itemType}`)
    }
    case "markChatItemAsDeletedAction": {
      const chat = history.findOne(action.targetId)
      return (action.retracted ? chalk.gray : chalk.red)(
        `[${action.retracted ? "retracted" : "deleted"}]${
          chat
            ? " " + `${chat.name} (${chat.cid}): ${chat.msg} (${chat.id})`
            : ""
        } ${chalk.gray(action.targetId)}`
      )
    }
    case "markChatItemsByAuthorAsDeletedAction": {
      const chats = history.findByChannelId(action.channelId)
      return chalk.bgRed(`=================
[deleteChatsBy ${chats[0]?.name} (${action.channelId})]
${chats
  .map((chat) => `- ${chat.msg} @ ${chat.oid}\n`)
  .join("")}=================`)
    }
    case "addSuperChatTickerAction": {
      return chalk.yellow(
        `<sc ${chalkSc(action.contents.color)(
          formatColor(action.startBackgroundColor, "hex")
        )} (${action.durationSec}/${action.fullDurationSec}) ${
          action.contents.authorName
        }: ${action.amountText}>`
      )
    }
    case "addSuperStickerTickerAction": {
      return chalk.yellow(
        `<super sticker (${action.durationSec}/${action.fullDurationSec}) ${action.authorName}: ${action.tickerPackName}>`
      )
    }
    case "addMembershipTickerAction": {
      return chalk.green(
        `<membership (${action.durationSec}/${
          action.fullDurationSec
        }) ${stringify(action.detailText)}>`
      )
    }
    case "addBannerAction": {
      return chalk.blue(`=================
[banner ${action.id}] ${stringify(action.title)}
${action.authorName}: ${stringify(action.message)}
=================`)
    }
    case "addRedirectBannerAction": {
      return chalk.yellowBright(`=================
[banner ${action.actionId}] ${stringify(action.targetId)}
${action.authorName} started redirecting their viewers to here}
=================`)
    }
    case "addViewerEngagementMessageAction": {
      return chalk.cyan(`[engagement] ${stringify(action.message)}`)
    }
    case "addPollResultAction": {
      return chalk.cyan(
        `[poll result] Q. ${
          action.question ? stringify(action.question) : "<empty>"
        }
${action.choices
  .map(
    (choice, i) =>
      `${i + 1}. ${stringify(choice.text)} (${choice.votePercentage})`
  )
  .join("\n")}`
      )
    }
    case "modeChangeAction": {
      return chalk.blue(`=================
[mode change] ${action.mode} -> ${chalk.red(action.enabled)}: ${stringify(
        action.description
      )}
=================`)
      break
    }
    case "removeBannerAction": {
      return chalk.cyan(`[removeBanner ${action.targetActionId}]`)
      break
    }
    case "showPollPanelAction": {
      return chalk.cyan(`=================
[openPoll ${action.id} (${action.pollType})] -> ${action.targetId}
${action.authorName}: ${action.question ? action.question : "<empty question>"}
${action.choices
  .map((choice, i) => {
    return `${i + 1}: ${stringify(choice.text)}`
  })
  .join("\n")}
=================`)
    }
    case "updatePollAction": {
      return chalk.cyan(
        `[updatePoll ${action.id}] ${action.authorName}: ${
          action.question ? action.question : "<empty question>"
        } - ${action.elapsedText} - ${action.voteCount} votes`
      )
    }
    case "closePanelAction": {
      return chalk.cyan(
        `[closePanel ${action.targetPanelId}] skipOnDismissCommand=${action.skipOnDismissCommand}`
      )
    }
    case "showTooltipAction": {
      if (action.promoConfig.promoId === "tip-edu-c-live-chat-banner-w") break

      return chalk.bgBlue.black(
        `[tooltip ${action.targetId}] ${stringify(action.promoConfig.promoId)}`
      )
    }
  }

  return (
    chalk.gray(JSON.stringify(action)) +
    chalk.bgCyan.black("[unhandled]", action.type)
  )
}
