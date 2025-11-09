import { Notice, type App } from "obsidian";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import type { RaindropBookmark, RaindropCollection, RaindropUser } from "./types";
import TokenManager from "./tokenManager";
import { Md5 } from "ts-md5";
import z from "zod";

const BASEURL = "https://api.raindrop.io/rest/v1";

const ZOptEmptyString = z.string().optional().default("");

const ZUser = z.object({
	user: z.object({
		fullName: ZOptEmptyString,
		groups: z.array(
			z.object({
				collections: z.array(z.number()),
				title: ZOptEmptyString,
			}),
		),
	}),
});

const ZRootCollection = z.object({
	items: z.array(
		z.object({
			_id: z.number(),
			title: ZOptEmptyString,
		}),
	),
});

const ZChildrentCollection = z.object({
	items: z.array(
		z.object({
			_id: z.number(),
			title: ZOptEmptyString,
			parent: z
				.object({
					$id: z.number(),
				})
				.optional(),
		}),
	),
});

const ZRaindrop = z.object({
	_id: z.number(),
	collectionId: z.number(),
	cover: ZOptEmptyString,
	created: z.coerce.date(),
	creatorRef: z.object({
		_id: z.number(),
		name: ZOptEmptyString,
	}),
	excerpt: ZOptEmptyString,
	highlights: z.array(
		z.object({
			color: z.string().optional().default("yellow"),
			created: z.coerce.date(),
			lastUpdate: z.coerce.date(),
			note: ZOptEmptyString,
			text: ZOptEmptyString,
			_id: z.string(),
		}),
	),
	important: z.boolean().optional().default(false),
	lastUpdate: z.coerce.date(),
	link: ZOptEmptyString,
	note: ZOptEmptyString,
	tags: z.array(z.string()),
	title: ZOptEmptyString,
	type: ZOptEmptyString,
});

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
		const [rawRootCollections, rawNestedCollections] = await Promise.all([
			this.get(`${BASEURL}/collections`, {}),
			this.get(`${BASEURL}/collections/childrens`, {}),
		]);

		const collections: RaindropCollection[] = [
			{ id: -1, title: "Unsorted", parentId: null },
			{ id: 0, title: "All bookmarks", parentId: null },
			{ id: -99, title: "Trash", parentId: null },
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
		const rootCollections = ZRootCollection.parse(rawRootCollections);
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
				parentId: null,
			});
		});

		const nestedCollectionMap: { [id: number]: NestedRaindropCollection } = {};
		const nestedCollections = ZChildrentCollection.parse(rawNestedCollections);
		nestedCollections.items.forEach((collection) => {
			const id = collection._id;
			nestedCollectionMap[id] = {
				title: collection.title,
				parentId: collection.parent?.$id ?? 0,
			};
		});

		nestedCollections.items.forEach((collection) => {
			const id = collection._id;
			let curParentId = collection.parent?.$id ?? 0;
			let title = collection.title;
			while (curParentId && curParentId in nestedCollectionMap) {
				title = `${nestedCollectionMap[curParentId].title}/${title}`;
				curParentId = nestedCollectionMap[curParentId].parentId;
			}
			if (curParentId && curParentId in rootCollectionMap) {
				title = `${rootCollectionMap[curParentId]}/${title}`;
			}
			collections.push({
				title: title,
				id: id,
				parentId: collection.parent?.$id ?? null,
			});
		});

		return collections;
	}

	async *getRaindropsAfter(
		collectionTitle: string,
		collectionId: number,
		showNotice: boolean,
		lastSync?: Date,
	): AsyncGenerator<RaindropBookmark[]> {
		let notice;
		if (showNotice) {
			notice = new Notice("Fetch Raindrops highlights", 0);
		}

		const pageSize = 50;
		const getPage = async (page: number) => {
			const res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
				page: page,
				perpage: pageSize,
				sort: "-created",
			});
			try {
				return ZRaindrops.parse(res);
			} catch (e) {
				console.error("Failed to parse raindrops page:", res);
				throw e;
			}
		};

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
					notice?.setMessage(
						`Sync "${collectionTitle}", pages: ${page + 1}/${totalPages}`,
					);
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
				while (
					bookmarks[bookmarks.length - 1].created.getTime() >= lastSync.getTime() &&
					remainPages--
				) {
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
		const { _id, highlights, creatorRef, ...rest } = raindrop;
		return {
			id: _id,
			creator: {
				id: creatorRef._id,
				name: creatorRef.name,
			},
			highlights: highlights.map((hl) => {
				const { _id, ...rest } = hl;
				return {
					id: _id,
					signature: Md5.hashStr(`${hl.color},${hl.text},${hl.note}`),
					...rest,
				};
			}),
			...rest,
		};
	}
}
