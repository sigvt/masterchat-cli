import { AddChatItemAction, stringify } from "masterchat"

export const CHAT_HISTORY_SIZE = 10000

export interface DbEntry {
  id: string
  cid: string
  oid: string
  name?: string
  msg: string
}

export class ChatHistory {
  db: DbEntry[] = []
  private sweep() {
    this.db.splice(0, this.db.length - CHAT_HISTORY_SIZE)
  }
  private transform(action: AddChatItemAction, oid: string): DbEntry {
    return {
      id: action.id,
      cid: action.authorChannelId,
      oid,
      name: action.authorName,
      msg: stringify(action.message),
    }
  }
  insert(action: AddChatItemAction, oid: string) {
    this.db.push(this.transform(action, oid))
    this.sweep()
  }
  bulkInsert(actions: AddChatItemAction[], oid: string) {
    this.db.push(...actions.map((action) => this.transform(action, oid)))
    this.sweep()
  }
  findByChannelId(channelId: string) {
    return this.db.filter((rec) => rec.cid === channelId).map((rec) => rec)
  }
  findOne(chatId: string) {
    return this.db.find((rec) => rec.id === chatId)
  }
}
