import { App, Notice, TFile } from "obsidian";
import sanitize from "sanitize-filename";
import { RaindropAPI } from "./api";
import type RaindropPlugin from "./main";
import Renderer from "./renderer";
import type { ArticleFile, RaindropArticle, SyncCollection } from "./types";

export default class RaindropSync {
	private app: App;
	private plugin: RaindropPlugin;
	private api: RaindropAPI;
	private renderer: Renderer;

	constructor(app: App, plugin: RaindropPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.api = new RaindropAPI(app, plugin);
		this.renderer = new Renderer(plugin);
	}

	async sync() {
		for (const id in this.plugin.settings.syncCollections) {
			const collection = this.plugin.settings.syncCollections[id];
			if (collection.sync) {
				await this.syncCollection(collection);
			}
		}
	}

	async syncCollection(collection: SyncCollection) {
		const highlightsFolder = this.plugin.settings.highlightsFolder;
		const collectionFolder = `${highlightsFolder}/${collection["title"]}`;
		try {
			await this.app.vault.createFolder(collectionFolder);
		} catch (e) {
			/* ignore folder already exists error */
		}

		let articles: RaindropArticle[] = [];
		try {
			// await this.api.getRaindropsAfter(collection.id, this.plugin.settings.lastSyncDate);
			articles = await this.api.getRaindropsAfter(
				0,
				new Date("2022-07-04")
			);
		} catch (e) {
			new Notice(`Raindrop Sync Failed: ${e.message}`);
		}

		this.syncArticles(articles, collectionFolder);
	}

	async syncArticles(articles: RaindropArticle[], collectionFolder: string) {
		const tfilesPath = new Set(
			this.app.vault.getMarkdownFiles().map((tfile) => tfile.path)
		);
		const articleFilesMap: { [id: number]: TFile } = Object.assign(
			{},
			...this.getArticleFiles().map((x) => ({ [x.raindropId]: x.file }))
		);

		articles.forEach((article) => {
			if (article.id in articleFilesMap) {
				this.updateFile(articleFilesMap[article.id], article);
			} else {
				let fileName = `${this.sanitizeTitle(article.title)}.md`;
				let filePath = `${collectionFolder}/${fileName}`;
				let suffix = 1;
				while (tfilesPath.has(filePath)) {
					console.debug(`${filePath} alreay exists`);
					fileName = `${this.sanitizeTitle(
						article.title
					)} (${suffix++}).md`;
					filePath = `${collectionFolder}/${fileName}`;
				}
				this.createFile(filePath, article);
			}
		});
	}

	async syncComplete() {
		this.plugin.settings.lastSyncDate = new Date();
		await this.plugin.saveSettings();
	}

	async updateFile(file: TFile, article: RaindropArticle) {
		const newMdContent = this.renderer.renderContent(article, false);
		const oldMdContent = await this.app.vault.cachedRead(file);
		const mdContent = oldMdContent + newMdContent;
		await this.app.vault.modify(file, mdContent);
	}

	async createFile(filePath: string, article: RaindropArticle) {
		const newMdContent = this.renderer.renderContent(article, true);
		const mdContent = this.renderer.addFrontMatter(newMdContent, article);
		await this.app.vault.create(filePath, mdContent);
	}

	getArticleFiles(): ArticleFile[] {
		return this.app.vault
			.getMarkdownFiles()
			.map((file) => {
				const cache = this.app.metadataCache.getFileCache(file);
				const raindropId = cache?.frontmatter?.raindrop_id;
				return { file, raindropId };
			})
			.filter(({ raindropId }) => {
				return raindropId;
			});
	}

	sanitizeTitle(title: string): string {
		const santizedTitle = title.replace(/[':#|]/g, "").trim();
		return sanitize(santizedTitle);
	}
}
