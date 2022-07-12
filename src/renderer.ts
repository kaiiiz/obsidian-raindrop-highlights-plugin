import matter from "gray-matter";
import nunjucks from "nunjucks";
import type RaindropPlugin from "./main";
import type { ArticleFileFrontMatter, RaindropArticle, RaindropHighlight } from "./types";


type RenderTemplate = {
	is_new_article: boolean;
	id: number;
	title: string;
	excerpt: string;
	link: string;
	highlights: RaindropHighlight[];
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

		const context: RenderTemplate = {
			is_new_article: newArticle,
			id,
			title,
			highlights,
			excerpt,
			link,
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
