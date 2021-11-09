# MasterChat CLI

[![npm](https://badgen.net/npm/v/masterchat-cli)](https://npmjs.org/package/masterchat-cli)
[![npm: total downloads](https://badgen.net/npm/dt/masterchat-cli)](https://npmjs.org/package/masterchat-cli)

See YouTube Live Chat through flexible filtering engine. For GUI version, see [Komet](https://github.com/holodata/komet).

## Install

```
npm i -g masterchat-cli
```

## Use

```
masterchat <videoUrl or videoId>
```

## Options

- `--type <string>`: Chat type (`top` or `all`)
- `--mod`: Show moderation events
- `--author`: Show author name
- `--filter <string>`: Filter rule

### Useful Filter Rules

Only show moderators' chat:

```bash
--filter isModerator
```

Only show chat from verified account or channel owner:

```bash
--filter 'isVerified || isOwner'
```

Only show super chat:

```bash
--filter superchat
```

Only show red super chat:

```bash
--filter 'superchat && superchat.color == "red"'
```

Only show membership chat:

```bash
--filter membership
```

Only show live translations:

```bash
--filter '/^(\\[[a-z]+?\\]|[a-z]+?: )/i.test(message)'
```

Only show chat contains 草:

```bash
--filter 'message.includes("草")'
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
