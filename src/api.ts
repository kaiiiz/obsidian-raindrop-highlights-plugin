import { Notice, type App } from "obsidian";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import type { RaindropBookmark, RaindropCollection, RaindropUser } from "./types";
import TokenManager from "./tokenManager";
import { Md5 } from "ts-md5";
import * as z from "zod/mini";

const BASEURL = "https://api.raindrop.io/rest/v1";

const ZUser = z.object({
	user: z.object({
		fullName: z.string(),
		groups: z.array(z.object({
			collections: z.array(z.number()),
			title: z.string(),
		}))
	})
})

const ZRootCollection = z.object({
	items: z.array(z.object({
		_id: z.number(),
		title: z.string(),
	}))
});

const ZChildrentCollection = z.object({
	items: z.array(z.object({
		_id: z.number(),
		title: z.string(),
		parent: z.optional(z.object({
			$id: z.number(),
		}))
	}))
})

const ZRaindrop = z.object({
	_id: z.number(),
	collectionId: z.number(),
	cover: z.string(),
	created: z.coerce.date(),
	creatorRef: z.object({
		_id: z.number(),
		name: z.string(),
	}),
	excerpt: z.string(),
	highlights: z.array(z.object({
		color: z.string(),
		created: z.coerce.date(),
		lastUpdate: z.coerce.date(),
		note: z.string(),
		text: z.string(),
		_id: z.string(),
	})),
	important: z.boolean(),
	lastUpdate: z.coerce.date(),
	link: z.string(),
	note: z.string(),
	tags: z.array(z.string()),
	title: z.string(),
	type: z.string(),
})

type TZRaindrop = z.infer<typeof ZRaindrop>;

const ZRaindrops = z.object({
	count: z.number(),
	items: z.array(ZRaindrop),
});

interface NestedRaindropCollection {
	title: string;
	parentId: number;
}

axiosRetry(axios, {
	retries: 3,
	retryCondition: (error: AxiosError) => {
		if (error.response && error.response.status === 429) {
			new Notice("Too many requests, will retry sync after 1 minute", 5);
			console.warn(`Too many requests, will retry sync after 1 minute`);
			return true;
		} else {
			console.error(`request error: ${error}`);
		}
		return false;
	},
	retryDelay: () => {
		return 60000;
	},
	onRetry: (retryCount) => {
		new Notice(`Retry sync ${retryCount}/3`);
	},
});

export class RaindropAPI {
	app: App;
	tokenManager: TokenManager;

	constructor(app: App) {
		this.app = app;
		this.tokenManager = new TokenManager();
	}

	private async get(url: string, params: Record<string, unknown>) {
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
			const user = await this.getUser();
			user.groups.forEach((g) => {
				g.collections.forEach((cid) => {
					collectionGroupMap[cid] = g.title;
				});
			});
		}

		const rootCollectionMap: { [id: number]: string } = {};
		const rootCollections = ZRootCollection.parse(await rootCollectionPromise);
		rootCollections.items.forEach((collection) => {
			const id = collection._id;
			let title = collection.title;
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
		const nestedCollections = ZChildrentCollection.parse(await nestedCollectionPromise);
		nestedCollections.items.forEach((collection) => {
			const id = collection._id;
			nestedCollectionMap[id] = {
				title: collection.title,
				parentId: collection.parent?.$id ?? 0,
			};
		});

		nestedCollections.items.forEach((collection) => {
			const id = collection._id;
			let parentId = collection.parent?.$id ?? 0;
			let title = collection.title;
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

	async *getRaindropsAfter(collectionId: number, showNotice: boolean, lastSync?: Date): AsyncGenerator<RaindropBookmark[]> {
		let notice;
		if (showNotice) {
			notice = new Notice("Fetch Raindrops highlights", 0);
		}

		const getPage = async (page: number) => {
			const res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
				page: page,
				perpage: pageSize,
				sort: "-created",
			});
			return ZRaindrops.parse(res);
		};

		const pageSize = 50;
		const res = await getPage(0);
		const raindropsCnt = res.count;
		const bookmarks = this.parseRaindrops(res.items);
		const totalPages = Math.ceil(raindropsCnt / pageSize);
		let remainPages = totalPages - 1;
		let page = 1;

		if (lastSync === undefined) {
			if (bookmarks.length > 0) {
				yield bookmarks;
				while (remainPages--) {
					notice?.setMessage(`Sync Raindrop pages: ${page + 1}/${totalPages}`);
					const res = await getPage(page++);
					yield this.parseRaindrops(res.items);
				}
			}
		} else {
			const filterCreated = (bookmarks: RaindropBookmark[]) => {
				return bookmarks.filter((bookmark) => {
					return bookmark.created.getTime() >= lastSync.getTime();
				});
			};
			const filteredBookmark = filterCreated(bookmarks);
			if (filteredBookmark.length > 0) {
				yield filteredBookmark;
				while (bookmarks[bookmarks.length - 1].created.getTime() >= lastSync.getTime() && remainPages--) {
					notice?.setMessage(`Sync Raindrop pages: ${page + 1}/${totalPages}`);
					const res = await getPage(page++);
					yield filterCreated(this.parseRaindrops(res.items));
				}
			}
		}

		notice?.hide();
	}

	async getUser(): Promise<RaindropUser> {
		const res = await this.get(`${BASEURL}/user`, {});
		const parsed = ZUser.parse(res);
		return parsed.user;
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
		} catch {
			throw new Error("Invalid token");
		}

		return ZUser.parse(result.data).user;
	}

	async getRaindrop(id: number): Promise<RaindropBookmark> {
		const res = await this.get(`${BASEURL}/raindrop/${id}`, {});
		const bookmark = this.parseRaindrop(ZRaindrop.parse(res.item));
		return bookmark;
	}

	private parseRaindrops(bookmarks: TZRaindrop[]): RaindropBookmark[] {
		return bookmarks.map(this.parseRaindrop);
	}

	private parseRaindrop(raindrop: TZRaindrop): RaindropBookmark {
		const {_id, highlights, creatorRef, ...rest} = raindrop;
		return {
			id: _id,
			creator: {
				id: creatorRef._id,
				name: creatorRef.name,
			},
			highlights: highlights.map((hl) => {
				const {_id, ...rest} = hl;
				return {
					id: _id,
					signature: Md5.hashStr(`${hl.color},${hl.text},${hl.note}`),
					...rest,
				}
			}),
			...rest,
		}
	}
}
