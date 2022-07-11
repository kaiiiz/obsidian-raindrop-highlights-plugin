export interface RaindropUser {
	fullName: string,
}

export interface RaindropCollection {
	title: string,
	id: number,
	lastUpdate: Date,
}

export interface SyncCollection {
	id: number,
	title: string,
	lastUpdate: Date,
	sync: boolean,
}

export interface SyncCollectionSettings {[id: number]: SyncCollection}
