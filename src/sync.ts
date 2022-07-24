import { App, Notice, TFile } from "obsidian";
import sanitize from "sanitize-filename";
import { RaindropAPI } from "./api";
import type RaindropPlugin from "./main";
import Renderer from "./renderer";
import type { ArticleFile, RaindropArticle, RaindropCollection, SyncCollection } from "./types";

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
		const allCollections = await this.api.getCollections();
		this.plugin.updateCollectionSettings(allCollections);

		for (const id in this.plugin.settings.syncCollections) {
			const collection = this.plugin.settings.syncCollections[id];
			if (collection.sync) {
				await this.syncCollection(collection);
			}
		}
	}

	async syncCollection(collection: SyncCollection) {
		new Notice(`Sync Raindrop collection: ${collection.title}`);
		const highlightsFolder = this.plugin.settings.highlightsFolder;
		const collectionFolder = `${highlightsFolder}/${collection["title"]}`;
		const lastSyncDate = this.plugin.settings.syncCollections[collection.id].lastSyncDate;

		let articles: RaindropArticle[] = [];
		try {
			console.debug('start sync collection:', collection.title, "last sync at:", lastSyncDate);
			articles = await this.api.getRaindropsAfter(collection.id, lastSyncDate);
		} catch (e) {
			console.error(e);
			new Notice(`Sync Raindrop collection ${collection.title} failed: ${e.message}`);
		}

		await this.syncArticles(articles, collectionFolder);
		await this.syncCollectionComplete(collection);
	}

	async syncArticles(articles: RaindropArticle[], folderPath: string) {
		try {
			await this.app.vault.createFolder(folderPath);
		} catch (e) {
			/* ignore folder already exists error */
		}

		const articleFilesMap: { [id: number]: TFile } = Object.assign(
			{},
			...this.getArticleFiles().map((x) => ({ [x.raindropId]: x.file }))
		);

		for (let article of articles) {
			if (article.id in articleFilesMap) {
				await this.updateFile(articleFilesMap[article.id], article);
			} else {
				let fileName = `${this.sanitizeTitle(article.title)}.md`;
				let filePath = `${folderPath}/${fileName}`;
				let suffix = 1;
				while (await this.app.vault.adapter.exists(filePath)) {
					console.debug(`${filePath} alreay exists`);
					fileName = `${this.sanitizeTitle(article.title)} (${suffix++}).md`;
					filePath = `${folderPath}/${fileName}`;
				}
				articleFilesMap[article.id] = await this.createFile(filePath, article);
			}
		}
	}

	async syncCollectionComplete(collection: RaindropCollection) {
		this.plugin.settings.syncCollections[collection.id].lastSyncDate = new Date();
		await this.plugin.saveSettings();
	}

	async updateFile(file: TFile, article: RaindropArticle) {
		const metadata = this.app.metadataCache.getFileCache(file);
		if (metadata?.frontmatter && 'raindrop_last_update' in metadata.frontmatter) {
			const localLastUpdate = new Date(metadata.frontmatter.raindrop_last_update);
			if (localLastUpdate >= article.lastUpdate) {
				console.debug('skip update file', file.path);
				return;
			}

			article.highlights = article.highlights.filter(hl => {
				return localLastUpdate < hl.lastUpdate;
			});
		}

		console.debug("update file", file.path);
		const newMdContent = this.renderer.renderContent(article, false);
		const oldMdContent = await this.app.vault.cachedRead(file);
		const mdContent = oldMdContent + newMdContent;
		await this.app.vault.modify(file, mdContent);
	}

	async createFile(filePath: string, article: RaindropArticle): Promise<TFile> {
		console.debug("create file", filePath);
		const newMdContent = this.renderer.renderContent(article, true);
		const mdContent = this.renderer.addFrontMatter(newMdContent, article);
		return this.app.vault.create(filePath, mdContent);
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
		return sanitize(santizedTitle).substring(0, 192);
	}
}
