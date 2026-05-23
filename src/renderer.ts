import nunjucks from "nunjucks";
import Moment from "moment";
import type RaindropPlugin from "./main";
import sanitize from "sanitize-filename";
import type { BookmarkFileFrontMatter, RaindropBookmark } from "./types";
import { parseYaml, requestUrl, stringifyYaml } from "obsidian";
import { AttachmentDownloader } from "./attachmentDownloader";
import Defuddle from "defuddle/full";

type RenderHighlight = {
	id: string;
	color: string;
	created: moment.Moment;
	lastUpdate: moment.Moment;
	note: string;
	text: string;
};

type RenderCollection = {
	title: string;
};

type RenderCreator = {
	name: string;
	id: number;
};

type RenderTemplate = {
	is_new_article: boolean;
	id: number;
	title: string;
	excerpt: string;
	note: string;
	link: string;
	highlights: RenderHighlight[];
	collection: RenderCollection;
	tags: string[];
	cover: string;
	created: moment.Moment;
	type: string;
	important: boolean;
	creator: RenderCreator;
	now: moment.Moment;
	raindropUrl: string;
};

const FAKE_RENDER_CONTEXT: RenderTemplate = {
	is_new_article: true,
	id: 1000,
	title: "fake_title",
	excerpt: "fake_excerpt",
	note: "fake_note",
	link: "https://example.com",
	highlights: [
		{
			id: "123456789abcdefghijklmno",
			color: "red",
			created: Moment(),
			lastUpdate: Moment(),
			note: "fake_note",
			text: "fake_text",
		},
	],
	collection: {
		title: "fake_collection",
	},
	tags: ["fake_tag1", "fake_tag2"],
	cover: "https://example.com",
	created: Moment(),
	type: "link",
	important: false,
	creator: {
		name: "fake_name",
		id: 10000,
	},
	now: Moment(),
	raindropUrl: "https://example.com",
};

export default class Renderer {
	plugin: RaindropPlugin;
	private attDownloader: AttachmentDownloader;

	constructor(plugin: RaindropPlugin) {
		this.plugin = plugin;
		this.attDownloader = new AttachmentDownloader(this.plugin.app);
	}

	async validate(template: string, isYaml = false): Promise<boolean> {
		try {
			const env = this.createEnv(FAKE_RENDER_CONTEXT, true);
			const fakeContent = await this.renderStringAsync(env, template, FAKE_RENDER_CONTEXT);
			if (isYaml) {
				const { id } = FAKE_RENDER_CONTEXT;
				const fakeMetadata = `raindrop_id: ${id}
${fakeContent}`;
				parseYaml(fakeMetadata);
			}
			return true;
		} catch {
			return false;
		}
	}

	async renderContent(bookmark: RaindropBookmark, newArticle: boolean): Promise<string> {
		return this.renderTemplate(this.plugin.settings.contentTemplate, bookmark, newArticle);
	}

	async renderFrontmatter(bookmark: RaindropBookmark, newArticle: boolean): Promise<string> {
		const newMdFrontmatter = await this.renderTemplate(
			this.plugin.settings.metadataTemplate,
			bookmark,
			newArticle,
		);
		const frontmatterObj: BookmarkFileFrontMatter = {
			raindrop_id: bookmark.id,
		};

		if (bookmark.highlights.length > 0) {
			frontmatterObj.raindrop_highlights = Object.fromEntries(
				bookmark.highlights.map((hl) => {
					return [hl.id, hl.signature];
				}),
			);
		}

		if (newMdFrontmatter.length > 0) {
			return `${stringifyYaml(frontmatterObj)}${newMdFrontmatter}`;
		} else {
			return stringifyYaml(frontmatterObj);
		}
	}

	async renderFullArticle(bookmark: RaindropBookmark): Promise<string> {
		const newMdContent = await this.renderContent(bookmark, true);
		const newMdFrontmatter = await this.renderFrontmatter(bookmark, true);
		const mdContent = `---\n${newMdFrontmatter}\n---\n${newMdContent}`;
		return mdContent;
	}

	async renderFileName(bookmark: RaindropBookmark, newArticle: boolean): Promise<string> {
		const filename = await this.renderTemplate(
			this.plugin.settings.filenameTemplate,
			bookmark,
			newArticle,
		);
		return this.sanitizeFilename(filename);
	}

	private sanitizeFilename(filename: string): string {
		return sanitize(filename.replace(/[':#|]/g, "").trim());
	}

	private renderTemplate(
		template: string,
		bookmark: RaindropBookmark,
		newArticle: boolean,
	): Promise<string> {
		const renderHighlights: RenderHighlight[] = bookmark.highlights.map((hl) => {
			const renderHighlight: RenderHighlight = {
				id: hl.id,
				color: hl.color,
				created: Moment(hl.created),
				lastUpdate: Moment(hl.lastUpdate),
				note: hl.note,
				text: hl.text,
			};
			return renderHighlight;
		});

		// the latest collection data is sync from Raindrop at the beginning of `sync` function
		const renderCollection: RenderCollection = {
			title: this.plugin.settings.syncCollections[bookmark.collectionId]?.title ?? "",
		};

		const context: RenderTemplate = {
			is_new_article: newArticle,
			id: bookmark.id,
			title: bookmark.title,
			excerpt: bookmark.excerpt,
			note: bookmark.note,
			link: bookmark.link,
			highlights: renderHighlights,
			collection: renderCollection,
			tags: bookmark.tags,
			cover: bookmark.cover,
			created: Moment(bookmark.created),
			type: bookmark.type,
			important: bookmark.important,
			creator: bookmark.creator,
			now: Moment(),
			raindropUrl: `https://app.raindrop.io/my/${bookmark.collectionId}/item/${bookmark.id}/edit`,
		};

		const env = this.createEnv(context);
		return this.renderStringAsync(env, template, context);
	}

	private renderStringAsync(
		env: nunjucks.Environment,
		template: string,
		context: object,
	): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			env.renderString(template, context, (err: Error | null, content: string | null) => {
				if (err) reject(err);
				else resolve(content ?? "");
			});
		});
	}

	private createEnv(renderContext?: RenderTemplate, isValidate = false): nunjucks.Environment {
		const env = new nunjucks.Environment(undefined, {
			autoescape: this.plugin.settings.enableAutoEscape,
		});
		env.addFilter("date", (date: moment.Moment, format: string) => {
			return date.format(format);
		});
		env.addFilter(
			"defuddle",
			(link: string, callback: (err: Error | null, result: string) => void) => {
				if (!link || isValidate) {
					callback(null, "");
					return;
				}

				requestUrl({ url: link })
					.then((response) => {
						const dom = new DOMParser().parseFromString(response.text, "text/html");
						const def = new Defuddle(dom, { url: link, markdown: true });
						const result = def.parse();
						callback(null, result.contentMarkdown ?? result.content);
					})
					.catch((err: Error) => {
						console.error(`Defuddle error for link ${link}:`, err);
						callback(null, `*Defuddle error: ${err.message}*`);
					});
			},
			true,
		);
		env.addFilter(
			"download_attachment",
			(url: unknown, ...args: unknown[]) => {
				const callback = args[args.length - 1] as (
					err: Error | null,
					result: string,
				) => void;
				const templateFilename = args.length > 1 ? String(args[0] ?? "") : undefined;

				const urlStr = url ? String(url) : "";
				if (!urlStr || isValidate) {
					callback(null, "");
					return;
				}

				const defaultFilename = renderContext ? `${renderContext.title}` : "attachment";
				const filename = templateFilename ?? defaultFilename;

				this.attDownloader
					.download(urlStr, filename)
					.then((result) => callback(null, result))
					.catch((err) => {
						console.error(`download_attachment: failed for ${urlStr}`, err);
						callback(null, urlStr);
					});
			},
			true,
		);
		return env;
	}
}
