import matter from "gray-matter";
import nunjucks from "nunjucks";
import Moment from "moment";
import type RaindropPlugin from "./main";
import type { ArticleFileFrontMatter, RaindropArticle } from "./types";

type RenderHighlight = {
	id: string,
	color: string,
	created: string,
	lastUpdate: string,
	note: string,
	text: string,
};

type RenderTemplate = {
	is_new_article: boolean;
	id: number;
	title: string;
	excerpt: string;
	link: string;
	highlights: RenderHighlight[];
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
		const { id , title, highlights, excerpt, link } = article;
		const dateTimeFormat = this.plugin.settings.dateTimeFormat;

		const renderHighlights: RenderHighlight[] = highlights.map(hl => {
			const renderHighlight: RenderHighlight = {
				id: hl['id'],
				color: hl['color'],
				created: Moment(hl['created']).format(dateTimeFormat),
				lastUpdate: Moment(hl['lastUpdate']).format(dateTimeFormat),
				note: hl['note'],
				text: hl['text'],
			};
			return renderHighlight;
		});

		const context: RenderTemplate = {
			is_new_article: newArticle,
			id,
			title,
			excerpt,
			link,
			highlights: renderHighlights,
		};
	
		const template = this.plugin.settings.template;
		const content = nunjucks.renderString(template, context);
		return content;
	}

	addFrontMatter(markdownContent: string, article: RaindropArticle) {
		const fm: ArticleFileFrontMatter = {
			raindrop_id: article.id,
		};
		return matter.stringify(markdownContent, fm);
	}
}
