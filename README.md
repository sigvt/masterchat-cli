# Masterchat CLI

[![npm](https://badgen.net/npm/v/masterchat-cli)](https://npmjs.org/package/masterchat-cli)
[![npm: total downloads](https://badgen.net/npm/dt/masterchat-cli)](https://npmjs.org/package/masterchat-cli)

See YouTube Live Chat through a flexible filtering engine. For a desktop app, see [☄️ Komet](https://github.com/holodata/komet).

## Install

```bash
npm i -g masterchat-cli

masterchat --help
mc --help
```

## Use

### `print`

Print live/replay chats.

```bash
mc print <video ID or URL>
mc print WpjhEqjngRQ --filter 'isSuperchat && color === "green"' --author # Only show green super chats
mc print WpjhEqjngRQ --filter 'isMember' # Only show chats from members
mc print WpjhEqjngRQ --filter 'isModerator || isVerified || isOwner' --author # Print chats from moderators/verified accounts/channel owner
mc print WpjhEqjngRQ --filter '/^(\\[[a-z]+?\\]|[a-z]+?: )/i.test(message)' # Print live translations
mc print WpjhEqjngRQ --filter 'message.includes("草")' # Only show chat contains 草
```

#### Options

- `--type, -t <string>`: Chat type (`top` or `all`)
- `--author, -a`: Show author name
- `--filter, -f <string>`: Filter chat/superchat events
- `--mod, -m`: Print moderation events
- `--verbose, -v`: Print additional info
- `--collect, -c`: Save received actions as JSONLines (.jsonl)

### `watch`

Print all events except live chats.

```bash
mc watch
mc watch --org Hololive
mc watch WpjhEqjngRQ
```

### `pbd`

pb params decoder.

```bash
mc pbd 'EglwbGF5bGlzdHM%3D'
```

## Community

Ask questions in `#masterchat` channel on [holodata Discord server](https://holodata.org/discord).

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/uetchy"><img src="https://avatars.githubusercontent.com/u/431808?v=4?s=50" width="50px;" alt=""/><br /><sub><b>uetchy</b></sub></a><br /><a href="https://github.com/holodata/masterchat-cli/commits?author=uetchy" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/DaniruKun"><img src="https://avatars.githubusercontent.com/u/5202322?v=4?s=50" width="50px;" alt=""/><br /><sub><b>Daniils Petrovs</b></sub></a><br /><a href="https://github.com/holodata/masterchat-cli/commits?author=DaniruKun" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
