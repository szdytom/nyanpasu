# 喵帕斯解析器 (nyanpasu)

喵帕斯解析器是一个 BiliBili 番剧视频和弹幕元数据的解析脚本，可用于快速缓存 BiliBili 番剧各集的数据。喵帕斯解析器可以根据链接自动下载和解析视频和弹幕元数据，并创建下载列表。

## 功能

喵帕斯解析器可以根据一个链接解析相关的资源数据和链接，它被设计为自动化工具链中的一环，在需要大量解析缓存番剧数据时可能十分有用。但是，请注意，喵帕斯解析器**不是**一个：

- 弹幕下载器：喵帕斯解析器可以找到下载弹幕的链接，并生成用于批量下载弹幕的脚本。但是实际的下载过程不是由喵帕斯解析器完成的（而是依赖于 [curl](https://github.com/curl/curl) 或其他命令行下载器），如果你仅仅希望下载某一视频的弹幕，你可能希望使用 [Bilibili-Evolved](https://github.com/the1812/Bilibili-Evolved) 这一浏览器插件。
- 视频下载器：喵帕斯解析器可以找到视频播放的链接，并生成用于批量下载视频的链接文件。但是实际的下载过程不是由喵帕斯解析器完成的（而是依赖于 [yt-dlp](https://github.com/yt-dlp/yt-dlp)），如果你仅仅希望下载某一视频，你可能希望直接使用 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 脚本。
- 弹幕播放器：喵帕斯解析器可以帮助你生成用于正确保存视频和弹幕的脚本，但是喵帕斯解析器不能理解视频或弹幕文件，如果你希望播放视频和弹幕，你可能希望使用 [KikoPlay](https://github.com/KikoPlayProject/KikoPlay) 或者其他类似的软件。
- DRM破解器：喵帕斯解析器没有任何魔法帮助你查看或破解你无权查看的数据和视频，喵帕斯解析器只能下载和分析公开的数据。
- 面向小白的应用程序：喵帕斯解析器不包含一个图形用户界面，它仅仅是基于命令行的，可能需要一定的计算机素养才能正确使用它。它在设计时优先考虑到在脚本或批处理任务中使用的情况。

## 安装

此脚本没有使用任何平台特定的代码，应当可以适用于所有主流操作系统，但是它只在 Linux 下测试过。

你需要首先安装 Node.JS 以运行此脚本。你可以从 Release 页面下载到一个压缩后脚本（`nyanpasu.mjs`），该文件已经将 NPM 依赖内嵌在文件中，因此不依赖第三方库。

对于 Linux 操作系统，该脚本包含正确的“井号注释”（shebang），可以直接赋予可执行权限以便执行。你可以考虑将其复制到 PATH 目录下（例如 `~/.local/bin` 或者 `/usr/local/bin`）以便于使用。

对于 Windows 操作系统，你可能需要将 `.mjs` 设置为默认使用 Node.JS 运行，或者每次运行时使用 `node --experimental-modules nyanpasu.mjs`。（由于本人对 Windows 的使用经验不足，这里的描述可能与实际情况有偏差，如果你有更好的打包方式，请随时打开一个 Issue 或 PR 讨论。）

你可能希望安装 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 及其依赖 [ffmpeg](https://ffmpeg.org/) 以便于下载视频。你可能还希望使用 [Tmux](https://github.com/tmux/tmux) 或者 [GNU Screen](https://www.gnu.org/software/screen/) 以防止因为关闭终端而导致下载中断。如果你下载了视频和弹幕文件，你可能希望安装 [KikoPlay](https://github.com/KikoPlayProject/KikoPlay) 弹幕播放器。

### AUR 安装

如果你使用 Arch Linux，你可以使用 [AUR](https://aur.archlinux.org/packages/nyanpasu-bin) 来安装此脚本，首先你需要安装一个 AUR 助手（假定为 [Yay](https://github.com/Jguer/yay)），然后运行命令：

```sh
yay -S nyanpasu-bin
```

## 构建

你也可以手工构建并打包此项目，首先你需要安装 Node.JS 和 npm，并下载本仓库，然后执行：

```
npm install
npm run build
```

即可在 `dist/nyanpasu.mjs` 找到输出。

此脚本的打包脚本通过 `build.cjs` 根据操作系统自动选择使用 `build.sh` 还是 `build.bat`，值得注意的是，适用于 Windows 的构建脚本没有经过充分测试，如果你遇到问题，请随时打开一个 Issue。

## 使用方法

首先，你需要得到番剧的一集的链接，并作为命令行参数传入脚本。以下以 [幸运星](https://www.bilibili.com/bangumi/play/ep35595) 为例，切换到一个合适的空目录并执行：

```sh
nyanpasu.mjs https://www.bilibili.com/bangumi/play/ep35595
```

得到类似于以下的输出：

```
Downloading descriptor info
Title: 幸运星
Count: 25 episodes
 * Episode 1: 狂奔的女人
 * Episode 2: 努力与结果
 * Episode 3: 形形色色的人们
 * Episode 4: 干劲的问题
 * Episode 5: 神射手
 * Episode 6: 夏天的例行节目
 * Episode 7: 印象
 * Episode 8: 即使不是我也很旺盛喔
 * Episode 9: 这种感觉
 * Episode 10: 愿望
 * Episode 11: 过平安夜的各种方法
 * Episode 12: 一起去祭典吧
 * Episode 13: 美味的日子
 * Episode 14: 同一个屋檐下
 * Episode 15: 一时变不过来
 * Episode 16: 循环
 * Episode 17: 名正言顺
 * Episode 18: 十个人十个样
 * Episode 19: 二次元的本质
 * Episode 20: 渡过夏天的方法
 * Episode 21: 潘朵拉的盒子
 * Episode 22: 在这里的彼方
 * Episode 23: 微妙的那条线
 * Episode 24: 未定
 * Episode 25: OVA
Command hint: yt-dlp -a vlist.txt -o "%(autonumber)s.%(ext)s"
```

并生成四个文件：

```plain
cache.json  descriptor.xml  download-danmu.sh  vlist.txt
```

其中 `cache.json` 是番剧元数据的缓存，`descriptor.xml` 是简化后的番剧元数据，可供人阅读或其他软件解析。`download-danmu.sh` 是用于下载弹幕数据和番剧封面图的脚本（内部使用 [curl](https://github.com/curl/curl)，如果你使用的是 Windows，你应该会得到内部使用 `Invoke-WebRequest` 的 PowerShell 脚本）。`vlist.txt` 是各集视频的链接，你可以进一步使用如下命令下载弹幕数据和番剧封面图：

```sh
./download-danmu.sh
```

如果你安装了 [yt-dlp](https://github.com/yt-dlp/yt-dlp)，你进一步可以根据 `vlist.txt` 中的链接下载各集视频：

```
yt-dlp -a vlist.txt -o "%(autonumber)s.%(ext)s"
```

根据需要，你可能需要添加 `--cookies`、`--cookies-from-browser`、`--abort-on-error` 等命令选项，注意可能无法下载付费视频和地区限制视频，可能会报错。关于更多信息，请参考 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 的文档。

### 关于缓存

在执行脚本后，会在当前目录下生成 `cache.json`，内部包含 BiliBili 关于番剧的元数据缓存。在第二次执行脚本时，如果检测到 `cache.json` 存在，则不再会重新请求，而是直接使用 `cache.json` 内部缓存的数据，**即使两次执行使用的 URL 参数不相同**。

`cache.json` 内部的格式可能并不稳定，请尽可能地使用 `descriptor.xml` 中的数据而不是 `cache.json`。

### 命令行选项

你也可以通过 `--help` 选项或阅读 `src/index.mjs` 源代码以查看喵帕斯解析器的命令行选项。

- `--skip-cache`：不读取/写入本地缓存 `cache.json`。
- `--skip-url`：不使用 URL 参数，而是读取本地缓存 `cache.json`。
- `--include-pv`：不将标记为“预告”的视频排除在外。
- `--min-duration <seconds>`：将时长小于给定值的视频排除在外，可用于筛选掉PV和MV。
- `--danmu-source`：选择使用 `comment.bilibili.com` 还是 `api.bilibili.com` 的弹幕链接，理论上没有区别。
- `--downloader-command`：选择脚本内使用 [curl](https://github.com/curl/curl) 还是 [Invoke-WebRequest](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-webrequest) 作为命令行下载器。
- `--script-format`：选择脚本的格式（可选 `bash`、`cmd` 或 `powershell`，亦可指定 `none` 以抑制解析器生成弹幕下载脚本）。
- `--downloader-args`：为命令行下载器指定额外的参数，注意该选项的值需要以引号包裹，并以空格开头，例如 `--downloader-args " -A -B --example"`。
- `--downloader-args-override`：覆盖命令行下载器的参数，注意该选项的值需要以引号包裹，并以空格开头，例如 `--downloader-args-override " -A -B --example"`。
- `--user-agent`：指定 HTTP 请求头中的 `User-Agent` 项的值。

## 社区

我们期待来自社区的贡献。如果您遇到了错误，请随时提出问题。还有许多可以添加的功能。如果您实现了任何增强功能，欢迎打开一个拉取请求。

## 名称

喵帕斯这个词出自 [悠哉日常大王](https://zh.moegirl.org.cn/%E6%82%A0%E5%93%89%E6%97%A5%E5%B8%B8%E5%A4%A7%E7%8E%8B)，请参见[百科条目](https://zh.moegirl.org.cn/%E5%96%B5%E5%B8%95%E6%96%AF)。

## 声明

请注意，本项目不代表上海宽娱数码科技有限公司或番剧版权方的意见，本项目按照“按其原样”的原则提供，不提供任何附带保证，使用者需承担可能的风险。

本项目完全开源，且没有任何代码加密操作，如有疑虑请自行审查代码或停止使用相关文件。此软件的行为代表其使用者的行为，而非代表其维护者的行为，如账户封禁或被盗等，维护者不对此负责，请谨慎使用。

请尊重数字版权，请勿二次分发使用此脚本（以及使用此脚本生成的脚本）得到文件。

## 版权

本项目使用 GNU 通用公共许可证 v2.0 许可证。根据该许可证，您有权复制、修改、分发本项目的源代码和衍生作品。然而，您必须遵守许可证中规定的条件，包括在您的衍生作品中保留原始版权信息和许可证，并在分发时提供许可证的副本。此外，您还需要确保任何引用或使用本项目的内容的用户也能够获得许可证的副本。请注意，GNU 通用公共许可证 v2.0 许可证不允许您将本项目的代码用于专有软件，因此任何基于本项目的衍生作品也必须使用GNU 通用公共许可证 v2.0 许可证发布。详细信息请见 `LICENSE` 文件。
