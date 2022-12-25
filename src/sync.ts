import { App, Notice, parseYaml, stringifyYaml, TFile } from "obsidian";
import sanitize from "sanitize-filename";
import type { RaindropAPI } from "./api";
import type RaindropPlugin from "./main";
import Renderer from "./renderer";
import type { BookmarkFile, BookmarkFileFrontMatter, RaindropBookmark, RaindropCollection, RaindropCache, SyncCollection } from "./types";

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

		let bookmarks: RaindropBookmark[] = [];
		try {
			console.debug('start sync collection:', collection.title, "last sync at:", lastSyncDate);
			bookmarks = await this.api.getRaindropsAfter(collection.id, lastSyncDate);
			await this.syncBookmarks(bookmarks, collectionFolder);
			await this.syncCollectionComplete(collection);
		} catch (e) {
			console.error(e);
			new Notice(`Sync Raindrop collection ${collection.title} failed: ${e.message}`);
		}
	}

	async syncBookmarks(bookmarks: RaindropBookmark[], folderPath: string) {
		try {
			await this.app.vault.createFolder(folderPath);
		} catch (e) {
			/* ignore folder already exists error */
		}

		const bookmarkFilesMap: { [id: number]: TFile } = Object.assign(
			{},
			...this.getBookmarkFiles().map((x) => ({ [x.raindropId]: x.file }))
		);

		for (let bookmark of bookmarks) {
			if (this.plugin.settings.onlyBookmarksWithHl && bookmark.highlights.length == 0) {
				continue;
			}

			if (bookmark.id in bookmarkFilesMap) {
				await this.updateFile(bookmarkFilesMap[bookmark.id], bookmark);
			} else {
				let fileName = `${this.sanitizeTitle(bookmark.title)}.md`;
				let filePath = `${folderPath}/${fileName}`;
				let suffix = 1;
				while (await this.app.vault.adapter.exists(filePath)) {
					console.debug(`${filePath} alreay exists`);
					fileName = `${this.sanitizeTitle(bookmark.title)} (${suffix++}).md`;
					filePath = `${folderPath}/${fileName}`;
				}
				bookmarkFilesMap[bookmark.id] = await this.createFile(filePath, bookmark);
			}
		}
	}

	async syncCollectionComplete(collection: RaindropCollection) {
		this.plugin.settings.syncCollections[collection.id].lastSyncDate = new Date();
		await this.plugin.saveSettings();
	}

	async updateFile(file: TFile, bookmark: RaindropBookmark) {
		if (this.plugin.settings.appendMode) {
			await this.updateFileAppendMode(file, bookmark);
		} else {
			await this.updateFileOverwriteMode(file, bookmark);
		}
	}

	async updateFileAppendMode(file: TFile, bookmark: RaindropBookmark) {
		console.debug("update file append mode", file.path);
		const metadata = this.app.metadataCache.getFileCache(file);
		
		if (metadata?.frontmatter && 'raindrop_last_update' in metadata.frontmatter) {
			const localLastUpdate = new Date(metadata.frontmatter.raindrop_last_update);
			if (localLastUpdate >= bookmark.lastUpdate) {
				console.debug('skip update file', file.path);
				return;
			}

			bookmark.highlights = bookmark.highlights.filter(hl => {
				return localLastUpdate < hl.lastUpdate;
			});
		}

		const appendedContent = this.renderer.renderContent(bookmark, false);

		await this.app.vault.append(file, appendedContent);

		// update raindrop_last_update
		if (metadata?.frontmatter) {
			// separate content and front matter
			const fileContent = await this.app.vault.cachedRead(file);
			const {position: {start, end}} = metadata.frontmatter;
			const article = this.splitFrontmatterAndContent(fileContent, end.line);

			const frontmatterObj: BookmarkFileFrontMatter = parseYaml(article.frontmatter);
			frontmatterObj.raindrop_last_update = (new Date()).toISOString();

			// stringify and concat
			const newFrontmatter = stringifyYaml(frontmatterObj);
			const newFullFileContent = `---\n${newFrontmatter}---\n${article.content}`;
			await this.app.vault.modify(file, newFullFileContent);
		}
	}

	async updateFileOverwriteMode(file: TFile, bookmark: RaindropBookmark) {
		console.debug("update file overwrite mode", file.path);
		const mdContent = this.renderer.renderFullArticle(bookmark);
		return this.app.vault.modify(file, mdContent);
	}

	async createFile(filePath: string, bookmark: RaindropBookmark): Promise<TFile> {
		console.debug("create file", filePath);
		const mdContent = this.renderer.renderFullArticle(bookmark);
		return this.app.vault.create(filePath, mdContent);
	}

	getBookmarkFiles(): BookmarkFile[] {
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

	private splitFrontmatterAndContent(content: string, fmEndLine: number): {
		content: string,
		frontmatter: string,
	} {
		// split content to -> [0, fmEndLine), [fmEndLine + 1, EOL)
		let splitPosFm = -1;
		while (fmEndLine-- && splitPosFm++ < content.length) {
			splitPosFm = content.indexOf("\n", splitPosFm);
			if (splitPosFm < 0) throw Error("Split front matter failed");
		}
		let splitPosContent = splitPosFm + 1;
		splitPosContent = content.indexOf("\n", splitPosContent) + 1;

		return {
			content: content.substring(splitPosContent),
			frontmatter: content.substring(0, splitPosFm),
		};
	}
}
