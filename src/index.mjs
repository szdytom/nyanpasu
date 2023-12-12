import fetch from 'node-fetch';
import xmldom from '@xmldom/xmldom';
import fs from 'node:fs/promises';
import xmlFormat from 'xml-formatter';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

const DESC_XMLNS = "nyanpasu:descriptor";

async function fetchDescriptor(url) {
	try {
		const response = await fetch(url);
		const html = await response.text();
		const regex = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s;;
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
};

function parseDescriptor(source) {
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

	for (let i = 0; i < data.episodes.length; ++i) {
		let edata = data.episodes[i];
		let episode = new AnimeEpisode(i + 1, edata.long_title, {
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
		anime.episodes.push(episode);
	}

	return anime;
}

let enableLogging = true;
function info(msg) {
	if (enableLogging) {
		console.log(`${msg}`);
	}
}

async function processDescriptor(rawDesc) {
	let anime = parseDescriptor(rawDesc);
	info(`Title: ${anime.title}`);
	info(`Count: ${anime.episodes.length} episodes`);
	for (let episode of anime.episodes) {
		info(` * Episode ${episode.id}: ${episode.title}`);
	}

	let doc = (new xmldom.DOMImplementation()).createDocument(DESC_XMLNS, 'xml');
	let xmlRoot = doc.firstChild;
	xmlRoot.appendChild(anime.toXML(doc));

	let xmlContent = xmlFormat((new xmldom.XMLSerializer()).serializeToString(doc), {
		collapseContent: true
	});
	let tasks = [];
	tasks.push(fs.writeFile('descriptor.xml', xmlContent));

	info('Command hint: yt-dlp -a vlist.txt -o "%(autonumber)s.%(ext)s" -f mp4');
	let d_script = '#!/bin/sh\n'
	let v_list = [], covers = new Set();
	for (let episode of anime.episodes) {
		const filename = `${episode.id.toString().padStart(5, '0')}.xml`;
		const download_link = `https://comment.bilibili.com/${episode.cid}.xml`;
		d_script += `wget -O ${filename} ${download_link}\n`;
		v_list.push(episode.link);
		covers.add(episode.cover);
	}

	let i = 1;
	for (let cover of covers) {
		d_script += `wget -O cover-${i}.jpg https:${cover}\n`;
		i += 1;
	}
	tasks.push(fs.writeFile('download-danmu.sh', d_script));
	tasks.push(fs.writeFile('vlist.txt', v_list.join('\n')));
	await Promise.all(tasks);
	await fs.chmod('download-danmu.sh', 0o755);
}

async function main() {
	const args = yargs(hideBin(process.argv))
		.option('no-cache', {
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
		}).usage('Uasge: <url>').help().alias('help', 'h').argv;
	const url = args._[0];
	enableLogging = !args.quiet;
	if (args.skipUrl && args.noCache) {
		console.error('There is nothing to do.');
		process.exit(1);
	}
	if (!args.skipUrl && url == null) {
		console.error('No url provided, please specify --skip-url.');
		process.exit(1);
	}

	let rawDesc;
	if (args.noCache) {
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
	await processDescriptor(rawDesc);

	if (process.env.TMUX == null && process.env.STY == null) {
		info('It seems that you are NOT inside a tmux or screen session!!');
	}
}

main()
