import { Notice, type App } from "obsidian";
import axios from "axios";
import type {
	RaindropBookmark,
	RaindropCollection,
	RaindropCollectionGroup,
	RaindropHighlight,
	RaindropUser,
} from "./types";
import TokenManager from "./tokenManager";

const BASEURL = "https://api.raindrop.io/rest/v1";

interface NestedRaindropCollection {
	title: string;
	parentId: number;
}

export class RaindropAPI {
	app: App;
	tokenManager: TokenManager;

	constructor(app: App) {
		this.app = app;
		this.tokenManager = new TokenManager();
	}

	private async get(url: string, params: any) {
		const token = this.tokenManager.get();
		if (!token) {
			throw new Error("Invalid token");
		}

		const result = await axios.get(url, {
			params: params,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (result.status == 401) {
			throw new Error("Unauthorized");
		}

		if (result.status !== 200) {
			console.error("Raindrop API request failed:", result);
			throw new Error("Request failed");
		}

		return result.data;
	}

	async getCollections(enableCollectionGroup: boolean): Promise<RaindropCollection[]> {
		const rootCollectionPromise = this.get(`${BASEURL}/collections`, {});
		const nestedCollectionPromise = this.get(`${BASEURL}/collections/childrens`, {});

		const collections: RaindropCollection[] = [
			{ id: -1, title: "Unsorted" },
			{ id: 0, title: "All bookmarks" },
			{ id: -99, title: "Trash" },
		];

		const collectionGroupMap: { [id: number]: string } = {};
		if (enableCollectionGroup) {
			const res = await this.get(`${BASEURL}/user`, {});
			const groups = this.parseGroups(res.user.groups);
			groups.forEach((g) => {
				g.collections.forEach((cid) => {
					collectionGroupMap[cid] = g.title;
				});
			});
		}

		const rootCollectionMap: { [id: number]: string } = {};
		const rootCollections = await rootCollectionPromise;
		rootCollections.items.forEach((collection: any) => {
			const id = collection["_id"];
			let title = collection["title"];
			if (enableCollectionGroup) {
				title = `${collectionGroupMap[id]}/${title}`;
			}
			rootCollectionMap[id] = title;
			collections.push({
				title: title,
				id: id,
			});
		});

		const nestedCollectionMap: { [id: number]: NestedRaindropCollection } = {};
		const nestedCollections = await nestedCollectionPromise;
		nestedCollections.items.forEach((collection: any) => {
			const id = collection["_id"];
			nestedCollectionMap[id] = {
				title: collection["title"],
				parentId: collection["parent"]["$id"],
			};
		});

		nestedCollections.items.forEach((collection: any) => {
			const id = collection["_id"];
			let parentId = collection["parent"]["$id"];
			let title = collection["title"];
			while (parentId && parentId in nestedCollectionMap) {
				title = `${nestedCollectionMap[parentId].title}/${title}`;
				parentId = nestedCollectionMap[parentId].parentId;
			}
			if (parentId && parentId in rootCollectionMap) {
				title = `${rootCollectionMap[parentId]}/${title}`;
			}
			collections.push({
				title: title,
				id: id,
			});
		});

		return collections;
	}

	async getRaindropsAfter(collectionId: number, lastSync?: Date, showNotice?: boolean): Promise<RaindropBookmark[]> {
		let notice;
		if (showNotice) {
			notice = new Notice("Fetch Raindrops highlights", 0);
		}
		const res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
			page: 0,
			perpage: 50,
			sort: "-lastUpdate",
		});
		const raindropsCnt = res.count;
		let bookmarks = this.parseRaindrops(res.items);
		let remainPages = Math.ceil(raindropsCnt / 50) - 1;
		const totalPages = Math.ceil(raindropsCnt / 50) - 1;
		let page = 1;

		const addNewPages = async (page: number) => {
			const res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
				page: page,
				perpage: 50,
				sort: "-lastUpdate",
			});
			bookmarks = bookmarks.concat(this.parseRaindrops(res.items));
		};

		if (bookmarks.length > 0) {
			if (lastSync === undefined) {
				// sync all
				while (remainPages--) {
					notice?.setMessage(`Sync Raindrop pages: ${totalPages - remainPages}/${totalPages}`);
					await addNewPages(page++);
				}
			} else {
				// sync article after lastSync
				while (bookmarks[bookmarks.length - 1].lastUpdate.getTime() >= lastSync.getTime() && remainPages--) {
					notice?.setMessage(`Sync Raindrop pages: ${totalPages - remainPages}/${totalPages}`);
					await addNewPages(page++);
				}
				bookmarks = bookmarks.filter((bookmark) => {
					return bookmark.lastUpdate.getTime() >= lastSync.getTime();
				});
			}
		}

		notice?.hide();
		return bookmarks;
	}

	async getUser(): Promise<RaindropUser> {
		const res = await this.get(`${BASEURL}/user`, {});
		return {
			fullName: res.user.fullName,
		};
	}

	async checkToken(token: string): Promise<RaindropUser> {
		let result;
		try {
			result = await axios.get(`${BASEURL}/user`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			if (result.status !== 200) {
				throw new Error("Invalid token");
			}
		} catch (e) {
			throw new Error("Invalid token");
		}

		const user = result.data.user;
		return {
			fullName: user.fullName,
		};
	}

	async getRaindrop(id: number): Promise<RaindropBookmark> {
		const res = await this.get(`${BASEURL}/raindrop/${id}`, {});
		const bookmark = this.parseRaindrop(res.item);
		return bookmark;
	}

	private parseRaindrops(bookmarks: any): RaindropBookmark[] {
		return bookmarks.map((raindrop: any) => {
			return this.parseRaindrop(raindrop);
		});
	}

	private parseRaindrop(raindrop: any): RaindropBookmark {
		const bookmark: RaindropBookmark = {
			id: raindrop["_id"],
			collectionId: raindrop["collectionId"],
			title: raindrop["title"],
			highlights: this.parseHighlights(raindrop["highlights"]),
			excerpt: raindrop["excerpt"],
			note: raindrop["note"],
			link: raindrop["link"],
			lastUpdate: new Date(raindrop["lastUpdate"]),
			tags: raindrop["tags"],
			cover: raindrop["cover"],
			created: new Date(raindrop["created"]),
			type: raindrop["type"],
			important: raindrop["important"],
			creator: {
				name: raindrop["creatorRef"]["name"],
				id: raindrop["creatorRef"]["_id"],
			},
		};
		return bookmark;
	}

	private parseHighlights(highlights: any): RaindropHighlight[] {
		return highlights.map((hl: any) => {
			const highlight: RaindropHighlight = {
				id: hl["_id"],
				color: hl["color"],
				text: hl["text"],
				lastUpdate: new Date(hl["lastUpdate"]),
				created: new Date(hl["created"]),
				note: hl["note"],
			};
			return highlight;
		});
	}

	private parseGroups(groups: any): RaindropCollectionGroup[] {
		return groups.map((g: any) => {
			const group: RaindropCollectionGroup = {
				title: g["title"],
				collections: g["collections"],
			};
			return group;
		});
	}
}
