import nunjucks from "nunjucks";
import Moment from "moment";
import type RaindropPlugin from "./main";
import type { RaindropArticle } from "./types";

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

	renderContent(article: RaindropArticle, newArticle = true) {
		const dateTimeFormat = this.plugin.settings.dateTimeFormat;

		const renderHighlights: RenderHighlight[] = article.highlights.map((hl) => {
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
			title: this.plugin.settings.syncCollections[article.collectionId].title,
		}

		const context: RenderTemplate = {
			is_new_article: newArticle,
			id: article.id,
			title: article.title,
			excerpt: article.excerpt,
			link: article.link,
			highlights: renderHighlights,
			collection: renderCollection,
			tags: article.tags,
			cover: article.cover,
			created: Moment(article.created).format(dateTimeFormat),
			type: article.type,
			important: article.important,
		};

		const template = this.plugin.settings.template;
		const content = nunjucks.renderString(template, context);
		return content;
	}
}
