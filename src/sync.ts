import { App, Notice, parseYaml, stringifyYaml, TFile } from "obsidian";
import sanitize from "sanitize-filename";
import type { RaindropAPI } from "./api";
import type RaindropPlugin from "./main";
import Renderer from "./renderer";
import type { ArticleFile, ArticleFileFrontMatter, RaindropArticle, RaindropCollection, SyncCollection } from "./types";

export default class RaindropSync {
	private app: App;
	private plugin: RaindropPlugin;
	private api: RaindropAPI;
	private renderer: Renderer;

	constructor(app: App, plugin: RaindropPlugin, api: RaindropAPI) {
		this.app = app;
		this.api = api;
		this.plugin = plugin;
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
			await this.syncArticles(articles, collectionFolder);
			await this.syncCollectionComplete(collection);
		} catch (e) {
			console.error(e);
			new Notice(`Sync Raindrop collection ${collection.title} failed: ${e.message}`);
		}
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
		await this.app.vault.append(file, newMdContent);

		// update frontmatter
		if (metadata?.frontmatter) {
			// separate content and front matter
			const fileContent = await this.app.vault.cachedRead(file);
			const {position: {start, end}} = metadata.frontmatter;
			const fileContentObj = this.splitFrontmatterAndContent(fileContent, start.line, end.line);

			// update frontmatter
			const frontmatterObj: ArticleFileFrontMatter = parseYaml(fileContentObj.frontmatter);
			frontmatterObj.raindrop_last_update = (new Date()).toISOString();

			// stringify and concat
			const newFrontmatter = stringifyYaml(frontmatterObj);
			const newFullFileContent = `---\n${newFrontmatter}---\n${fileContentObj.content}`;
			await this.app.vault.modify(file, newFullFileContent);
		}
	}

	async createFile(filePath: string, article: RaindropArticle): Promise<TFile> {
		console.debug("create file", filePath);
		const newMdContent = this.renderer.renderContent(article, true);
		const frontmatter: ArticleFileFrontMatter = {
			raindrop_id: article.id,
			raindrop_last_update: (new Date()).toISOString(),
		};
		const frontmatterStr = stringifyYaml(frontmatter);
		const mdContent = `---\n${frontmatterStr}---\n${newMdContent}`;
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

	private splitFrontmatterAndContent(content: string, fmStartLine: number, fmEndLine: number): {
		content: string,
		frontmatter: string,
	} {
		const filecontentLine = content.split("\n");
		const frontmatterLine = filecontentLine.splice(fmStartLine, fmEndLine - fmStartLine + 1);
		const filecontentStr = filecontentLine.join("\n");
		frontmatterLine.pop(); // remove the end of "---" in the frontmatter for `parseYaml`
		const frontmatterStr = frontmatterLine.join("\n");
		return {
			content: filecontentStr,
			frontmatter: frontmatterStr,
		};
	}
}
