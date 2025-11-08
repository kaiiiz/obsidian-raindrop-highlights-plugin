import { App, normalizePath, Notice, parseYaml, stringifyYaml, TFile } from "obsidian";
import type { RaindropAPI } from "./api";
import type RaindropPlugin from "./main";
import Renderer from "./renderer";
import truncate from "truncate-utf8-bytes";
import type { BookmarkFile, BookmarkFileFrontMatter, RaindropBookmark, RaindropCollection, SyncCollection } from "./types";

interface SplitedMarkdown {
	content: string;
	frontmatter: string;
}

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

	async sync({ fullSync }: { fullSync: boolean }) {
		const collectionGroup = this.plugin.settings.collectionGroups;
		const allCollections = await this.api.getCollections(collectionGroup);
		this.plugin.updateCollectionSettings(allCollections);

		for (const id in this.plugin.settings.syncCollections) {
			const collection = this.plugin.settings.syncCollections[id];
			if (collection.sync) {
				await this.syncCollection(collection, fullSync);
			}
		}
	}

	async syncSingle({ file }: { file: TFile | null }) {
		let raindropId: number;
		if (file) {
			const fmc = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!fmc?.raindrop_id) {
				new Notice("This is not a Raindrop bookmark file");
				return;
			} else {
				raindropId = Number(fmc.raindrop_id);
			}
		} else {
			new Notice("No active file");
			return;
		}

		const bookmark = await this.api.getRaindrop(raindropId);
		await this.updateFileContent(file, bookmark);
		// Do not perform path sync here!
		// Since we do not know which collection sync this bookmark (e.g. bookmark "b1" in "Collection 1" may also be synced if you enable "All Bookmarks" collection), which leads to ambiguity.
		new Notice(`Sync ${bookmark.title} completed`);
	}

	private getSyncFolder(collection: SyncCollection) {
		if (this.plugin.settings.autoSyncSuccessNotice) {
			new Notice(`Sync Raindrop collection: ${collection.title}`);
		}
		const highlightsFolder = this.plugin.settings.highlightsFolder;
		let collectionFolder = highlightsFolder;
		if (this.plugin.settings.collectionsFolders) {
			collectionFolder = `${highlightsFolder}/${collection["title"]}`;
		}
		return collectionFolder;
	}

	private async syncCollection(collection: SyncCollection, fullSync: boolean) {
		const syncFolder = this.getSyncFolder(collection);
		const lastSyncDate = fullSync ? undefined : this.plugin.settings.syncCollections[collection.id].lastSyncDate;

		try {
			if (lastSyncDate === undefined) {
				console.debug(`start sync collection: ${collection.title}, full sync`);
			} else {
				console.debug(`start sync collection: ${collection.title}, last sync at: ${lastSyncDate}`);
			}
			for await (const bookmarks of this.api.getRaindropsAfter(collection.id, this.plugin.settings.autoSyncSuccessNotice, lastSyncDate)) {
				await this.syncBookmarks(bookmarks, syncFolder);
			}
			await this.syncCollectionComplete(collection);
		} catch (e) {
			console.error(e);
			new Notice(`Sync Raindrop collection ${collection.title} failed: ${e instanceof Error ? e.message : "Unknown error"}`);
		}
	}

	private async syncBookmarks(bookmarks: RaindropBookmark[], folderPath: string) {
		if (bookmarks.length == 0) return;

		if (this.plugin.settings.onlyBookmarksWithHl) {
			const requireUpdate = bookmarks.some((bookmark) => {
				return bookmark.highlights.length != 0;
			});
			if (!requireUpdate) return;
		}

		try {
			await this.app.vault.createFolder(folderPath);
		} catch {
			/* ignore folder already exists error */
		}

		const bookmarkFilesMap: { [id: number]: TFile } = Object.assign({}, ...this.getBookmarkFiles().map((x) => ({ [x.raindropId]: x.file })));

		for (const bookmark of bookmarks) {
			if (this.plugin.settings.onlyBookmarksWithHl && bookmark.highlights.length == 0) {
				continue;
			}

			if (bookmark.id in bookmarkFilesMap) {
				await this.updateFileContent(bookmarkFilesMap[bookmark.id], bookmark);
				await this.updateFileName(bookmarkFilesMap[bookmark.id], bookmark, folderPath);
			} else {
				const renderedFilename = this.renderer.renderFileName(bookmark, true);
				const filePath = await this.buildNonDupFilePath(folderPath, renderedFilename);
				bookmarkFilesMap[bookmark.id] = await this.createFile(filePath, bookmark);
			}
		}
	}

	private buildFilePath(folderPath: string, renderedFilename: string, suffix?: number): string {
		let fileSuffix = ".md";
		let fileName = truncate(`${renderedFilename}`, 255 - fileSuffix.length) + fileSuffix;
		if (suffix) {
			fileSuffix = ` (${suffix++}).md`;
			fileName = truncate(`${renderedFilename}`, 255 - fileSuffix.length) + fileSuffix;
		}
		return normalizePath(`${folderPath}/${fileName}`);
	}

	private async buildNonDupFilePath(folderPath: string, renderedFilename: string): Promise<string> {
		let filePath = this.buildFilePath(folderPath, renderedFilename);
		let suffix = 1;
		while (await this.app.vault.adapter.exists(filePath)) {
			console.debug(`${filePath} alreay exists`);
			filePath = this.buildFilePath(folderPath, renderedFilename, suffix++);
		}
		return filePath;
	}

	private async syncCollectionComplete(collection: RaindropCollection) {
		this.plugin.settings.syncCollections[collection.id].lastSyncDate = new Date();
		await this.plugin.saveSettings();
	}

	private async updateFileName(file: TFile, bookmark: RaindropBookmark, folderPath: string) {
		const renderedFilename = this.renderer.renderFileName(bookmark, true);
		let newFilePath = this.buildFilePath(folderPath, renderedFilename);
		const newFileMeta = this.app.metadataCache.getCache(newFilePath);
		// check new file is the same as the old file
		if (newFileMeta?.frontmatter && "raindrop_id" in newFileMeta.frontmatter && newFileMeta.frontmatter.raindrop_id == bookmark.id) {
			console.debug(`file name of "${file.path}" is not changed`);
			return;
		}
		// other cases: move to the non existing path
		newFilePath = await this.buildNonDupFilePath(folderPath, renderedFilename);
		console.debug(`file name change detected, rename "${file.path}" to "${newFilePath}"`);
		await this.app.fileManager.renameFile(file, newFilePath);
	}

	private async updateFileContent(file: TFile, bookmark: RaindropBookmark) {
		if (this.plugin.settings.appendMode) {
			await this.updateFileAppendMode(file, bookmark);
		} else {
			await this.updateFileOverwriteMode(file, bookmark);
		}
	}

	private async updateFileAppendMode(file: TFile, bookmark: RaindropBookmark) {
		console.debug(`update file append mode ${file.path}`);
		const metadata = this.app.metadataCache.getFileCache(file);
		const highlightSigs = Object.fromEntries(bookmark.highlights.map((hl) => [hl.id, hl.signature]));

		if (metadata?.frontmatter && "raindrop_highlights" in metadata.frontmatter) {
			const localHighlights = metadata.frontmatter.raindrop_highlights;
			bookmark.highlights = bookmark.highlights.filter((hl) => {
				return !(hl.id in localHighlights && hl.signature === localHighlights[hl.id]);
			});
		}

		const appendedContent = this.renderer.renderContent(bookmark, false);

		await this.app.vault.append(file, appendedContent);

		// update front matter
		const fileContent = await this.app.vault.cachedRead(file);
		const bookmarkFm = this.renderer.renderFrontmatter(bookmark, false);
		const bookmarkFmObj: BookmarkFileFrontMatter = parseYaml(bookmarkFm);
		bookmarkFmObj.raindrop_highlights = highlightSigs;
		if (metadata?.frontmatterPosition) {
			// merge with existing front matter
			const article = this.splitFrontmatterAndContent(fileContent, metadata.frontmatterPosition.end.line);

			// merge bookmark front matter and file front matter
			const fileFmObj: BookmarkFileFrontMatter = parseYaml(article.frontmatter);
			const newFmObj: BookmarkFileFrontMatter = { ...fileFmObj, ...bookmarkFmObj };

			if (Object.keys(highlightSigs).length == 0 && "raindrop_highlights" in newFmObj) {
				delete newFmObj["raindrop_highlights"];
			}

			// stringify and concat
			const newFrontmatter = stringifyYaml(newFmObj);
			const newFullFileContent = `---\n${newFrontmatter}---\n${article.content}`;
			await this.app.vault.modify(file, newFullFileContent);
		} else {
			if (Object.keys(highlightSigs).length == 0 && "raindrop_highlights" in bookmarkFmObj) {
				delete bookmarkFmObj["raindrop_highlights"];
			}
			const newFrontmatter = stringifyYaml(bookmarkFmObj);
			const newFullFileContent = `---\n${newFrontmatter}---\n${fileContent}`;
			await this.app.vault.modify(file, newFullFileContent);
		}
	}

	private async updateFileOverwriteMode(file: TFile, bookmark: RaindropBookmark) {
		console.debug("update file overwrite mode", file.path);
		const mdContent = this.renderer.renderFullArticle(bookmark);
		return this.app.vault.modify(file, mdContent);
	}

	private async createFile(filePath: string, bookmark: RaindropBookmark): Promise<TFile> {
		console.debug("create file", filePath);
		const mdContent = this.renderer.renderFullArticle(bookmark);
		return this.app.vault.create(filePath, mdContent);
	}

	private getBookmarkFiles(): BookmarkFile[] {
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

	private splitFrontmatterAndContent(content: string, fmEndLine: number): SplitedMarkdown {
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
