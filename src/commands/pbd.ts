import { b64d, B64Type, parsePb, pprintPbValue } from "masterchat"
import { Arguments, CommandModule } from "yargs"

interface Args {
  input: string
  type: B64Type
}

function handler({ input, type }: Arguments<Args>) {
  const buf = b64d(input, type)
  const pl = parsePb(buf)
  pprintPbValue(pl)
}

export const pbd: CommandModule<{}, Args> = {
  command: "pbd <input> [type]",
  describe: "inspect protobuf token",
  builder: {
    input: {
      desc: "token string",
      required: true,
    },
    type: {
      desc: "token type",
      choices: Object.values(B64Type),
      default: B64Type.B1,
    },
  },
  handler,
}
