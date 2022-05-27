import chalk from "chalk"
import {
  ChatResponse,
  formatColor,
  Masterchat,
  stringify,
  SuperChat,
} from "masterchat"
import { ChatHistory } from "./history"

export function printData({
  data,
  history,
  mc,
  prefix,
  maxChats = 0,
  verbose = false,
  showTicker = false,
}: {
  data: ChatResponse
  history: ChatHistory
  mc: Masterchat
  prefix?: string
  maxChats?: number
  verbose?: boolean
  showTicker?: boolean
}) {
  function log(...obj: any) {
    const lines = obj.join(" ").split("\n")
    for (const line of lines) {
      if (prefix) process.stdout.write(chalk.gray(prefix) + " ")
      console.log(line)
    }
  }

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

  let chatCount = 0
  for (const action of actions) {
    switch (action.type) {
      case "addChatItemAction": {
        if (chatCount < maxChats) {
          log(
            chalk.gray(`${action.authorChannelId} ${action.authorName}:`),
            stringify(action.message!)
          )
          chatCount += 1
        }

        history.insert(action, mc.channelId)
        break
      }
      case "addSuperChatItemAction": {
        log(
          chalk.yellow(
            `[sc] ${chalkSc(action.color)(
              `${action.amount} ${action.currency}`
            )} ${action.authorName}: ${stringify(
              action.message ?? "<empty message>"
            )}`
          )
        )
        break
      }
      case "addSuperStickerItemAction": {
        log(
          chalk.yellow(
            `[super sticker] ${stringify(action.authorName)}: ${
              action.stickerText
            }`
          )
        )
        break
      }
      case "addMembershipItemAction": {
        log(
          chalk.green(
            `[membership joined] Welcome${
              action.level ? ` ${action.level},` : ""
            } ${action.authorName} !: ${action.membership.status} ${
              action.membership.since ?? ""
            }`
          )
        )
        break
      }
      case "addMembershipMilestoneItemAction": {
        log(
          chalk.green(
            `[milestone ${action.authorName} (${action.membership.status} ${
              action.membership.since ?? ""
            })] Member${action.level ? ` of ${action.level}` : ""} for ${
              action.durationText
            } (${action.duration}): ${
              action.message ? stringify(action.message) : "<empty message>"
            }`
          )
        )
        break
      }
      case "membershipGiftPurchaseAction": {
        log(
          chalk.green(
            `[membership gift purchase] ${action.authorName} (${
              action.membership.status
            } ${action.membership.since ?? ""}) gifted ${
              action.amount
            } memberships for ${action.channelName}`
          )
        )
        break
      }
      case "membershipGiftRedemptionAction": {
        log(
          chalk.green(
            `[membership gift redemption] ${action.authorName} was gifted a membership by ${action.senderName}`
          )
        )
        break
      }
      case "addPlaceholderItemAction": {
        const id = action.id
        const target = history.findOne(id)?.msg
        log(
          chalk.blue(
            `[placeholder]${target ? " " + target : ""} ${chalk.gray(
              action.id
            )}`
          )
        )
        break
      }
      case "replaceChatItemAction": {
        const id = action.targetItemId
        const item = action.replacementItem
        const itemType = Object.keys(item)[0]
        // const target = history.findOne(id)?.msg;
        log(chalk.blue(`[replace] ${id} → ${itemType}`))
        break
      }
      case "markChatItemAsDeletedAction": {
        const chat = history.findOne(action.targetId)
        log(
          (action.retracted ? chalk.gray : chalk.red)(
            `[${action.retracted ? "retracted" : "deleted"}]${
              chat
                ? " " + `${chat.name} (${chat.cid}): ${chat.msg} (${chat.id})`
                : ""
            } ${chalk.gray(action.targetId)}`
          )
        )
        break
      }
      case "markChatItemsByAuthorAsDeletedAction": {
        const chats = history.findByChannelId(action.channelId)
        log(
          chalk.bgRed(`=================
[deleteChatsBy ${chats[0]?.name} (${action.channelId})]
${chats
  .map((chat) => `- ${chat.msg} @ ${chat.oid}\n`)
  .join("")}=================`)
        )
        break
      }
      case "addSuperChatTickerAction": {
        if (!showTicker) break
        log(
          chalk.yellow(
            `<sc ${chalkSc(action.contents.color)(
              formatColor(action.startBackgroundColor, "hex")
            )} (${action.durationSec}/${action.fullDurationSec}) ${
              action.contents.authorName
            }: ${action.amountText}>`
          )
        )
        break
      }
      case "addSuperStickerTickerAction": {
        // if (!showTicker) break;
        log(
          chalk.yellow(
            `<super sticker (${action.durationSec}/${action.fullDurationSec}) ${action.authorName}: ${action.tickerPackName}>`
          )
        )
        break
      }
      case "addMembershipTickerAction": {
        if (!showTicker) break
        log(
          chalk.green(
            `<membership (${action.durationSec}/${
              action.fullDurationSec
            }) ${stringify(action.detailText)}>`
          )
        )
        break
      }
      case "addBannerAction": {
        log(
          chalk.blue(`=================
[banner ${action.id}] ${stringify(action.title)}
${action.authorName}: ${stringify(action.message)}
=================`)
        )
        break
      }
      case "addRedirectBannerAction": {
        log(
          chalk.yellowBright(`=================
[banner ${action.actionId}] ${stringify(action.targetId)}
${action.authorName} started redirecting their viewers to here}
=================`)
        )
        break
      }
      case "addViewerEngagementMessageAction": {
        log(chalk.cyan(`[engagement] ${stringify(action.message)}`))
        break
      }
      case "addPollResultAction": {
        log(
          chalk.cyan(
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
        )
        break
      }
      case "modeChangeAction": {
        log(
          chalk.blue(`=================
[mode change] ${action.mode} -> ${chalk.red(action.enabled)}: ${stringify(
            action.description
          )}
=================`)
        )
        break
      }
      case "removeBannerAction": {
        log(chalk.cyan(`[removeBanner ${action.targetActionId}]`))
        break
      }
      case "showPollPanelAction": {
        log(
          chalk.cyan(`=================
[openPoll ${action.id} (${action.pollType})] -> ${action.targetId}
${action.authorName}: ${action.question ? action.question : "<empty question>"}
${action.choices
  .map((choice, i) => {
    return `${i + 1}: ${stringify(choice.text)}`
  })
  .join("\n")}
=================`)
        )
        break
      }
      case "updatePollAction": {
        log(
          chalk.cyan(
            `[updatePoll ${action.id}] ${action.authorName}: ${
              action.question ? action.question : "<empty question>"
            } - ${action.elapsedText} - ${action.voteCount} votes`
          )
        )
        break
      }
      case "closePanelAction": {
        log(
          chalk.cyan(
            `[closePanel ${action.targetPanelId}] skipOnDismissCommand=${action.skipOnDismissCommand}`
          )
        )
        break
      }
      case "showTooltipAction": {
        if (action.promoConfig.promoId === "tip-edu-c-live-chat-banner-w") break

        log(
          chalk.bgBlue.black(
            `[tooltip ${action.targetId}] ${stringify(
              action.promoConfig.promoId
            )}`
          )
        )
        break
      }
      default:
        log(chalk.gray(JSON.stringify(action)))
        log(chalk.bgCyan.black("[unhandled]", action.type))
    }
  }
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
