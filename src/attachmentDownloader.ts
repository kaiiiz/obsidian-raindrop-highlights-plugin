import { normalizePath, requestUrl } from "obsidian";
import type { App } from "obsidian";

const CONTENT_TYPE_EXT: Record<string, string> = {
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/gif": ".gif",
	"image/webp": ".webp",
	"image/svg+xml": ".svg",
	"image/bmp": ".bmp",
	"image/avif": ".avif",
};

function detectExtension(url: string, contentType?: string): string {
	try {
		const pathname = new URL(url).pathname;
		const match = pathname.match(/\.(\w{2,4})$/);
		if (match?.[1]) return `.${match[1].toLowerCase()}`;
	} catch {
		// invalid URL
	}

	if (contentType) {
		const primary = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
		if (CONTENT_TYPE_EXT[primary]) return CONTENT_TYPE_EXT[primary];
	}

	console.warn(
		`Could not detect file extension for URL: ${url} with content type: ${contentType}`,
	);
	return ".jpg";
}

async function sha256(data: ArrayBuffer): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sanitizeFilename(name: string): string {
	return normalizePath(name)
		.replace(/[\\/:*?"<>|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function getAttachmentFolder(app: App): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const configPath: string = (app.vault as any).getConfig?.("attachmentFolderPath") ?? "";
		if (!configPath || configPath === ".") return "";
		return configPath;
	} catch {
		return "";
	}
}

const MAX_ATTEMPTS = 100000; // To avoid infinite loops in case of unexpected issues happening

async function findOrCreateFile(
	app: App,
	folder: string,
	filename: string,
	ext: string,
	contentHash: string,
	data: ArrayBuffer,
): Promise<string> {
	if (folder) {
		await app.vault.createFolder(folder).catch(() => {});
	}

	for (let seq = 0; seq < MAX_ATTEMPTS; seq++) {
		const filenameExt = seq === 0 ? `${filename}${ext}` : `${filename} (${seq})${ext}`;
		const filePath = normalizePath(folder ? `${folder}/${filenameExt}` : filenameExt);

		try {
			const exists = await app.vault.adapter.exists(filePath);
			if (!exists) {
				await app.vault.createBinary(filePath, data);
				return filePath;
			}

			const existingData = await app.vault.adapter.readBinary(filePath);
			const existingHash = await sha256(existingData);
			if (existingHash === contentHash) {
				return filePath;
			}
		} catch (err) {
			// race condition or transient issue, try next suffix
			console.warn(`Attempt ${seq + 1}: Failed to create or verify file ${filePath}`, err);
		}
	}

	throw new Error(`Could not create file for "${filename}${ext}" after ${MAX_ATTEMPTS} attempts`);
}

export class AttachmentDownloader {
	constructor(private app: App) {}

	/**
	 * Download a URL to the Obsidian attachment folder.
	 *
	 * @param url       The remote URL to download.
	 * @param filename  Desired filename (without extension). Sanitized internally.
	 * @returns Vault-relative path on success, or the original url on failure.
	 */
	async download(url: string, filename: string): Promise<string> {
		if (!url) return "";
		const urlStr = String(url);
		if (!urlStr) return "";

		try {
			const response = await requestUrl({ url: urlStr, method: "GET" });
			if (response.status !== 200) return urlStr;

			const data = response.arrayBuffer;
			const contentType = response.headers["content-type"];
			const ext = detectExtension(urlStr, contentType);
			const hash = await sha256(data);
			const folder = getAttachmentFolder(this.app);
			const filenameSanitized = sanitizeFilename(filename);

			return findOrCreateFile(this.app, folder, filenameSanitized, ext, hash, data);
		} catch (err) {
			console.error(`AttachmentDownloader: failed for ${urlStr}`, err);
			return urlStr;
		}
	}
}
