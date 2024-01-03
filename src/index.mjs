import fetch from 'node-fetch';
import xmldom from '@xmldom/xmldom';
import fs from 'node:fs/promises';
import xmlFormat from 'xml-formatter';
import { platform } from 'node:os';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

const DESC_XMLNS = "nyanpasu:descriptor";

async function fetchDescriptor(url) {
	try {
		const response = await fetch(url);
		const html = await response.text();
		const regex = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s;
		const match = html.match(regex);

		if (match && match[1]) {
			const jsonData = JSON.parse(match[1]);
			return jsonData;
		} else {
			throw new Error('Failed to extract JSON data from HTML');
		}
	} catch (error) {
		throw error;
	}
}

function createTextChild(document, tagName, content) {
	let res = document.createElement(tagName);
	if (content != null) {
		res.textContent = content.toString();
	}
	return res;
}

class Anime {
	constructor(title, data, stat) {
		this.title = title;
		this.data = data;
		this.stat = stat;
		this.episodes = [];
	}

	toXML(document) {
		let animeRoot = document.createElement('anime');
		animeRoot.appendChild(createTextChild(document, 'title', this.title));

		const data_fields = ['seasonId', 'mediaId', 'alias'];
		for (let field of data_fields) {
			animeRoot.appendChild(createTextChild(document, field, this.data[field]));
		}

		let statRoot = document.createElement('statistics');
		animeRoot.appendChild(statRoot);
		const stat_fields = [
			'coins', 'danmakus', 'favorite', 'favorites', 'likes',
			'reply', 'share', 'views',
		];
		for (let field of stat_fields) {
			statRoot.appendChild(createTextChild(document, field, this.stat[field]));
		}
		let ratingNode = document.createElement('rating');
		statRoot.appendChild(ratingNode);
		ratingNode.textContent = this.stat.rating.score.toString();
		ratingNode.setAttribute('count', this.stat.rating.count.toString());

		let episodesRoot = document.createElement('episodes');
		animeRoot.appendChild(episodesRoot);
		for (let episode of this.episodes) {
			episodesRoot.appendChild(episode.toXML(document));
		}
		animeRoot.appendChild(createTextChild(document, 'exportTime', Math.floor(Date.now() / 1000)));

		return animeRoot;
	}
};

class AnimeEpisode {
	constructor(id, title, data) {
		this.id = id;
		this.title = title;
		this.data = data;
	}

	get cid() {
		return this.data.cid;
	}

	get link() {
		return this.data.link;
	}

	get cover() {
		return this.data.cover;
	}

	toXML(document) {
		let episodeRoot = document.createElement('episode');
		episodeRoot.appendChild(createTextChild(document, 'index', this.id));
		episodeRoot.appendChild(createTextChild(document, 'title', this.title));
		const data_fields = [
			'displayTitle', 'cid', 'bvid', 'aid',
			'duration', 'publishTime', 'link', 'releaseDate'
		];
		for (let field of data_fields) {
			episodeRoot.appendChild(createTextChild(document, field, this.data[field]));
		}
		if (this.data.skip != null) {
			let skipSections = document.createElement('skip');
			episodeRoot.appendChild(skipSections);
			for (let section of ['op', 'ed']) {
				if (this.data.skip[section] != null) {
					let sectionRoot = document.createElement(section);
					skipSections.appendChild(sectionRoot);
					sectionRoot.setAttribute('start', this.data.skip[section].start.toString());
					sectionRoot.setAttribute('end', this.data.skip[section].end.toString());
				}
			}
		}
		return episodeRoot;
	}

	toString() {
		return `Episode ${this.id}: ${this.title}`;
	}
};

class DownloadTarget {
	constructor(uri, compressed) {
		this.uri = uri;
		this.compressed = compressed ?? false;
	}
};

class DownloadCommand {
	constructor(defaultArgs, supportFlags, { customArgs, overrideArgs }) {
		if (overrideArgs != null) {
			this.args = overrideArgs;
		} else {
			this.args = defaultArgs + customArgs;
		}
		if (this.args.length && this.args[0] != ' ') {
			this.args = ' ' + this.args;
		}

		this.supportFlags = supportFlags;
	}

	support(flag) {
		return this.supportFlags.contains(flag);
	}
};

class CurlDownloadCommand extends DownloadCommand {
	constructor(config) {
		super('-Lgf', ['Win32Cmd', 'Linux', 'PowerShell'], config);
	}

	downloadFile(target, filename) {
		if (target.compressed) {
			return `curl${this.args} --compressed -o "${filename}" "${target.uri}"`;
		}
		return `curl${this.args} -o "${filename}" "${target.uri}"`;
	}
};

class PowerShellDownloadCommand extends DownloadCommand {
	constructor(config) {
		super('', ['PowerShell'], config);
	}

	downloadFile(target, filename) {
		return `Invoke-WebRequest${this.args} -Uri "${target.uri}" -OutFile "${filename}"`;
	}
};

class DownloadScriptBuilder {
	constructor(flag, downloader) {
		this.dmLinks = [];
		this.cvLinks = [];
		this.cvLinksURI = new Set();
		this.downloader = downloader;
		this.flag = flag;
	}

	addDm(link) {
		this.dmLinks.push(link);
	}

	addCover(link) {
		if (this.cvLinksURI.has(link.uri)) {
			return;
		}

		this.cvLinksURI.add(link.uri);
		this.cvLinks.push(link);
	}

	downloadFile(target, file) {
		return this.downloader.downloadFile(target, file);
	}
};

class BashDownloadScriptBuilder extends DownloadScriptBuilder {
	constructor(downloader) {
		super('Linux', downloader);
	}

	accumulate() {
		let script = [];
		script.push('#!/bin/sh');
		script.push('set -e');

		let i = 1;
		for (let link of this.dmLinks) {
			const iName = i.toString().padStart(5, '0');
			script.push(this.downloadFile(link, `${iName}.xml`));
			i += 1;
		}

		i = 1;
		for (let link of this.cvLinks) {
			script.push(this.downloadFile(link, `cover-${i}.jpg`));
		}
		return script.join('\n');
	}

	extension() {
		return '.sh';
	}
};

class WinCmdDownloadScriptBuilder extends DownloadScriptBuilder {
	constructor(downloader) {
		super('Win32', downloader);
	}

	accumulate() {
		let cmd = [];
		let i = 1;
		for (let link of this.dmLinks) {
			const iName = i.toString().padStart(5, '0');
			cmd.push(this.downloadFile(link, `${iName}.xml`));
			i += 1;
		}

		i = 1;
		for (let link of this.cvLinks) {
			cmd.push(this.downloadFile(link, `cover-${i}.jpg`));
		}

		return `@echo off\r\n${cmd.join(' && ')}\r\n`;
	}

	extension() {
		return '.bat';
	}
};

class PowerShellDownloadScriptBuilder extends DownloadScriptBuilder {
	constructor(downloader) {
		super('PowerShell', downloader);
	}

	accumulate() {
		let script = [];
		script.push('$ErrorActionPreference = "Stop"');

		let i = 1;
		for (let link of this.dmLinks) {
			const iName = i.toString().padStart(5, '0');
			script.push(this.downloadFile(link, `${iName}.xml`));
			i += 1;
		}

		i = 1;
		for (let link of this.cvLinks) {
			script.push(this.downloadFile(link, `cover-${i}.jpg`));
		}
		return script.join('\r\n');
	}

	extension() {
		return '.ps1';
	}
};

class NullDownloadScriptBuilder extends DownloadScriptBuilder {
	constructor(downloader) {
		super(null, downloader);
	}

	accumulate() {
		return null;
	}

	extension() {
		return null;
	}
};

class DanmuDownloadSource {
	constructor() {
	}
};

class CommentDanmuDownloadSource extends DanmuDownloadSource {
	constructor() {
		super();
	}

	convert(cid) {
		return new DownloadTarget(`https://comment.bilibili.com/${cid}.xml`, true);
	}
};

class ApiCurrentDanmuDownloadSource extends DanmuDownloadSource {
	constructor() {
		super();
	}

	convert(cid) {
		return new DownloadTarget(`https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`, true);
	}
};

let enableLogging = true;
function info(msg) {
	if (enableLogging) {
		console.log(`${msg}`);
	}
}

function parseDescriptor(source, includePv, minDuration) {
	const data = source.props?.pageProps?.dehydratedState?.queries[0]?.state?.data?.seasonInfo?.mediaInfo
	if (data == null) {
		throw new Error('Cannot parse descriptor: media info not found');
	}

	let stat = data.stat;
	let anime = new Anime(data.title, {
		alias: data.alias,
		seasonId: data.season_id,
		mediaId: data.media_id
	}, {
		coins: stat.coins,
		danmakus: stat.danmakus,
		favorite: stat.favorite,
		favorites: stat.favorites,
		likes: stat.likes,
		reply: stat.reply,
		share: stat.share,
		views: stat.views,
		rating: data.rating,
	});

	let duration_warn = false;
	let episode_id = 1;
	for (let i = 0; i < data.episodes.length; ++i) {
		let edata = data.episodes[i];
		let episode = new AnimeEpisode(episode_id, edata.long_title, {
			aid: edata.aid,
			bvid: edata.bvid,
			cid: edata.cid,
			duration: edata.duration,
			cover: edata.cover,
			link: edata.link,
			publishTime: edata.pub_time,
			releaseDate: edata.release_date,
			displayTitle: edata.playerEpTitle,
			skip: edata.skip,
		});

		if (!includePv && edata.badge != null && edata.badge.search('预告') != -1) {
			info(`Filtered pv (specify --include-pv to keep): ${episode.toString()}`);
		} else if (edata.duration < minDuration * 1000) {
			info(`Filtered by duration: ${episode.toString()}`);
		} else {
			if (edata.duration < 180000 && minDuration === 0) { // 3 minute
				duration_warn = true;
			}
			episode_id += 1;
			anime.episodes.push(episode);
		}
	}

	if (duration_warn) {
		info('Some of the videos are shorter than 3 minutes, you may want to specify --min-duration to filter them out');
	}

	return anime;
}

async function processDescriptor(rawDesc, includePv, minDuration, scriptBuilder, danmuSource) {
	let anime = parseDescriptor(rawDesc, includePv, minDuration);
	info(`Title: ${anime.title}`);
	info(`Count: ${anime.episodes.length} episodes`);

	for (let episode of anime.episodes) {
		info(` * ${episode.toString()}`);
	}

	let doc = (new xmldom.DOMImplementation()).createDocument(DESC_XMLNS, 'xml');
	let xmlRoot = doc.firstChild;
	xmlRoot.appendChild(anime.toXML(doc));

	let xmlContent = xmlFormat((new xmldom.XMLSerializer()).serializeToString(doc), {
		collapseContent: true
	});
	let tasks = [];
	tasks.push(fs.writeFile('descriptor.xml', xmlContent));

	info('Command hint: yt-dlp -a vlist.txt -o "%(autonumber)s.%(ext)s"');
	let v_list = [];
	for (let episode of anime.episodes) {
		scriptBuilder.addDm(danmuSource.convert(episode.cid));
		scriptBuilder.addCover(new DownloadTarget('https:' + episode.cover));
		v_list.push(episode.link);
	}

	const scriptFilename = `download-danmu${scriptBuilder.extension()}`;
	let script = scriptBuilder.accumulate();

	tasks.push(fs.writeFile('vlist.txt', v_list.join('\n')));
	if (script != null) {
		tasks.push(fs.writeFile(scriptFilename, script));
	}
	await Promise.all(tasks);
	if (script != null) {
		await fs.chmod(scriptFilename, 0o755);
	}
}

async function main() {
	const args = yargs(hideBin(process.argv))
		.option('skip-cache', {
			description: 'Ignore local cache.json',
			type: 'boolean',
			default: false,
		}).option('skip-url', {
			description: 'Skip url for downloading descriptor',
			type: 'boolean',
			default: false,
		}).option('quiet', {
			description: 'Do not output logs other than errors',
			type: 'boolean',
			default: false,
			alias: 'q',
		}).option('include-pv', {
			description: 'Include pv in the playlist',
			type: 'boolean',
			default: false,
		}).option('min-duration', {
			description: 'Filter episodes with duration too small (unit: second)',
			type: 'number',
			default: 0,
		}).option('danmu-source', {
			description: 'Source of danmu download (<value>.bilibili.com)',
			alias: 'D',
			choices: ['comment', 'api'],
			default: 'comment',
		}).option('downloader-command', {
			description: 'Command to use in the download script',
			alias: 'c',
			choices: ['curl', 'invoke-webrequest', 'auto'],
			default: 'auto',
		}).option('script-format', {
			description: 'Format of the download script',
			alias: 'F',
			choices: ['none', 'bash', 'cmd', 'powershell'],
			default: platform() === 'win32' ? 'powershell' : 'bash',
		}).option('downloader-args', {
			description: 'Extra arguments/flags passed to the downloader command',
			type: 'string',
			default: '',
		}).option('downloader-args-override', {
			description: 'Override the arguments/flags passed to the downloader command',
			type: 'string',
			default: null,
		}).option('suppress-tmux-warning', {
			description: 'Suppress warning of not inside a TMUX session',
			type: 'boolean',
			default: false,
		}).usage('Uasge: <url>').version('0.1.4').help().alias('help', 'h').argv;

	const url = args._[0];
	enableLogging = !args.quiet;
	if (args.skipUrl && args.skipCache) {
		console.error('There is nothing to do.');
		process.exit(1);
	}

	if (!args.skipUrl && url == null) {
		console.error('No url provided, please specify --skip-url.');
		process.exit(1);
	}

	if (args.downloaderArgsOverride != null && args.downloaderArgs != '') {
		info('Flag --downloader-args will not take effect because --downloader-args-override specified');
	}

	let danmuSourceMap = {
		'api': ApiCurrentDanmuDownloadSource,
		'comment': CommentDanmuDownloadSource,
	};
	let danmuSource = new danmuSourceMap[args.danmuSource]();

	let downloaderType = args.downloaderCommand;
	if (downloaderType === 'auto') {
		if (args.scriptFormat === 'powershell') {
			downloaderType = 'invoke-webrequest';
		} else {
			downloaderType = 'curl';
		}
	}

	const downloaderMap = {
		'curl' : CurlDownloadCommand,
		'invoke-webrequest': PowerShellDownloadCommand,
	};
	let downloader = new downloaderMap[downloaderType]({
		customArgs: args.downloaderArgs,
		overrideArgs: args.downloaderArgsOverride,
	});

	const scriptBuilderMap = {
		'none': NullDownloadScriptBuilder,
		'bash': BashDownloadScriptBuilder,
		'cmd': WinCmdDownloadScriptBuilder,
		'powershell': PowerShellDownloadScriptBuilder,
	};
	let scriptBuilder = new scriptBuilderMap[args.scriptFormat](downloader);

	let rawDesc;
	if (args.skipCache) {
		info('Downloading descriptor info (no cache)');
		rawDesc = await fetchDescriptor(url);
	} else {
		try {
			await fs.access('cache.json');
			info('Using cached descriptor info');
			rawDesc = JSON.parse(await fs.readFile('cache.json'));
		} catch (err) {
			if (args.skipUrl) {
				console.error('cache.json not found');
				process.exit(1);
			}
			info('Downloading descriptor info');
			rawDesc = await fetchDescriptor(url);
			await fs.writeFile('cache.json', JSON.stringify(rawDesc));
		}
	}

	await processDescriptor(rawDesc, args.includePv, args.minDuration, scriptBuilder, danmuSource);

	if (!args.suppressTmuxWarning && process.env.TMUX == null && process.env.STY == null) {
		info('It seems that you are NOT inside a tmux or screen session!!');
	}
}

main().catch(err => {
	console.error(`An exception happened: ${err}`);
	process.exit(1);
});

