import nunjucks from "nunjucks";
import Moment from "moment";
import type RaindropPlugin from "./main";
import type { BookmarkFileFrontMatter, RaindropBookmark } from "./types";
import { stringifyYaml } from "obsidian";

type RenderHighlight = {
	id: string;
	color: string;
	created: string;
	lastUpdate: string;
	note: string;
	text: string;
};

type RenderCollection = {
	title: string;
};

type RenderTemplate = {
	is_new_article: boolean;
	id: number;
	title: string;
	excerpt: string;
	link: string;
	highlights: RenderHighlight[];
	collection: RenderCollection;
	tags: string[];
	cover: string;
	created: string;
	type: string;
	important: boolean;
};

export default class Renderer {
	plugin: RaindropPlugin;

	constructor(plugin: RaindropPlugin) {
		this.plugin = plugin;
		nunjucks.configure({ autoescape: false });
	}

	validate(template: string): boolean {
		try {
			nunjucks.renderString(template, {});
			return true;
		} catch (error) {
			return false;
		}
	}

	renderContent(bookmark: RaindropBookmark, newArticle = true) {
		const dateTimeFormat = this.plugin.settings.dateTimeFormat;

		const renderHighlights: RenderHighlight[] = bookmark.highlights.map((hl) => {
			const renderHighlight: RenderHighlight = {
				id: hl.id,
				color: hl.color,
				created: Moment(hl.created).format(dateTimeFormat),
				lastUpdate: Moment(hl.lastUpdate).format(dateTimeFormat),
				note: hl.note,
				text: hl.text,
			};
			return renderHighlight;
		});

		// sync() should keep the latest collection data in local in the beginning
		const renderCollection: RenderCollection = {
			title: this.plugin.settings.syncCollections[bookmark.collectionId].title,
		}

		const context: RenderTemplate = {
			is_new_article: newArticle,
			id: bookmark.id,
			title: bookmark.title,
			excerpt: bookmark.excerpt,
			link: bookmark.link,
			highlights: renderHighlights,
			collection: renderCollection,
			tags: bookmark.tags,
			cover: bookmark.cover,
			created: Moment(bookmark.created).format(dateTimeFormat),
			type: bookmark.type,
			important: bookmark.important,
		};

		const template = this.plugin.settings.template;
		const content = nunjucks.renderString(template, context);
		return content;
	}

	renderFullPost(bookmark: RaindropBookmark) {
		const newMdContent = this.renderContent(bookmark, true);
		const frontmatter: BookmarkFileFrontMatter = {
			raindrop_id: bookmark.id,
			raindrop_last_update: (new Date()).toISOString(),
		};
		const frontmatterStr = stringifyYaml(frontmatter);
		const mdContent = `---\n${frontmatterStr}---\n${newMdContent}`;
		return mdContent;
	}
}
