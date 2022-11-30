import nunjucks from "nunjucks";
import Moment from "moment";
import type RaindropPlugin from "./main";
import type { BookmarkFileFrontMatter, RaindropBookmark } from "./types";
import { Notice, parseYaml, stringifyYaml } from "obsidian";

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
	collectionTitle: string;
	tags: string[];
	cover: string;
	created: string;
	type: string;
	important: boolean;
};

const FAKE_RENDER_CONTEXT: RenderTemplate = {
	is_new_article: true,
	id: 1000,
	title: "fake_title",
	excerpt: "fake_excerpt",
	link: "https://example.com",
	highlights: [
		{
			id: "123456789abcdefghijklmno",
			color: "red",
			created: "2022-08-11T01:58:27.457Z",
			lastUpdate: "2022-08-13T01:58:27.457Z",
			note: "fake_note",
			text: "fake_text",
		}
	],
	collection: {
		title: "fake_collection",
	},
	collectionTitle: "fake_collection",
	tags: ["fake_tag1", "fake_tag2"],
	cover: "https://example.com",
	created: "2022-08-10T01:58:27.457Z",
	type: "link",
	important: false,
};

export default class Renderer {
	plugin: RaindropPlugin;

	constructor(plugin: RaindropPlugin) {
		this.plugin = plugin;
		nunjucks.configure({ autoescape: false });
	}

	validate(template: string, isYaml=false): boolean {
		try {
			const fakeContent = nunjucks.renderString(template, FAKE_RENDER_CONTEXT);
			if (isYaml) {
				const {id, created} = FAKE_RENDER_CONTEXT;
				const fakeMetadata = `raindrop_id: ${id}\nraindrop_last_update: ${created}\n${fakeContent}`
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
		let frontmatter: BookmarkFileFrontMatter = {
			raindrop_id: bookmark.id,
			raindrop_last_update: (new Date()).toISOString(),
		};
		try {
			frontmatter = {
				...frontmatter,
				...parseYaml(newMdFrontmatter),
			};
		} catch (e) {
			console.error(e);
			new Notice(`Failed to parse YAML for ${bookmark.title}: ${e.message}`)
		}
		return stringifyYaml(frontmatter);
	}

	renderFullArticle(bookmark: RaindropBookmark) {
		const newMdContent = this.renderContent(bookmark, true);
		const newMdFrontmatter = this.renderFrontmatter(bookmark, true);
		const mdContent = `---\n${newMdFrontmatter}---\n${newMdContent}`;
		return mdContent;
	}

	private renderTemplate(template:string, bookmark: RaindropBookmark, newArticle: boolean) {
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

		// the latest collection data is sync from Raindrop at the beginning of `sync` function
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
			collectionTitle: renderCollection.title,
			tags: bookmark.tags,
			cover: bookmark.cover,
			created: Moment(bookmark.created).format(dateTimeFormat),
			type: bookmark.type,
			important: bookmark.important,
		};
		
		const content = nunjucks.renderString(template, context);
		return content;
	}
}
