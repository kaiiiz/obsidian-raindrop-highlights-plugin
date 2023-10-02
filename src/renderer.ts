import nunjucks from "nunjucks";
import Moment from "moment";
import type RaindropPlugin from "./main";
import sanitize from "sanitize-filename";
import type { RaindropBookmark } from "./types";
import { parseYaml } from "obsidian";

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
};

export default class Renderer {
	plugin: RaindropPlugin;

	constructor(plugin: RaindropPlugin) {
		this.plugin = plugin;
		nunjucks.configure({ autoescape: false });
	}

	validate(template: string, isYaml = false): boolean {
		try {
			const env = this.createEnv();
			const fakeContent = env.renderString(template, FAKE_RENDER_CONTEXT);
			if (isYaml) {
				const { id, created } = FAKE_RENDER_CONTEXT;
				const fakeMetadata = `raindrop_id: ${id}
raindrop_last_update: ${created}
${fakeContent}`;
				parseYaml(fakeMetadata);
			}
			return true;
		} catch (error) {
			return false;
		}
	}

	renderContent(bookmark: RaindropBookmark, newArticle: boolean) {
		return this.renderTemplate(this.plugin.settings.template, bookmark, newArticle);
	}

	renderFrontmatter(bookmark: RaindropBookmark, newArticle: boolean) {
		const newMdFrontmatter = this.renderTemplate(this.plugin.settings.metadataTemplate, bookmark, newArticle);
		if (newMdFrontmatter.length > 0) {
			return `raindrop_id: ${bookmark.id}
raindrop_last_update: ${new Date().toISOString()}
${newMdFrontmatter}\n`;
		} else {
			return `raindrop_id: ${bookmark.id}
raindrop_last_update: ${new Date().toISOString()}\n`;
		}
	}

	renderFullArticle(bookmark: RaindropBookmark) {
		const newMdContent = this.renderContent(bookmark, true);
		const newMdFrontmatter = this.renderFrontmatter(bookmark, true);
		const mdContent = `---\n${newMdFrontmatter}---\n${newMdContent}`;
		return mdContent;
	}

	renderFileName(bookmark: RaindropBookmark, newArticle: boolean) {
		const filename = this.renderTemplate(this.plugin.settings.filenameTemplate, bookmark, newArticle);
		return this.sanitizeFilename(filename);
	}

	private sanitizeFilename(filename: string): string {
		return sanitize(filename.replace(/[':#|]/g, "").trim());
	}

	private renderTemplate(template: string, bookmark: RaindropBookmark, newArticle: boolean) {
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
			title: this.plugin.settings.syncCollections[bookmark.collectionId].title,
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
		};

		const env = this.createEnv();
		const content = env.renderString(template, context);
		return content;
	}

	private createEnv(): nunjucks.Environment {
		const env = new nunjucks.Environment();
		env.addFilter("date", (date: moment.Moment, format: string) => {
			return date.format(format);
		});
		return env;
	}
}
