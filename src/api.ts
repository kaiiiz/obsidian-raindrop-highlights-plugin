import { App } from "obsidian";
import { TokenManager } from "./store/token";

export class RaindropAPI {
	app: App;
	private tokenManager: TokenManager;

	constructor(app: App, tokenManager: TokenManager) {
		this.app = app;
		this.tokenManager = tokenManager;
	}

	// async checkToken(token: string): Promise<RaindropUser> {
	// 	const result = await fetch("https://api.raindrop.io/rest/v1/user", {
	// 		method: "GET",
	// 		headers: new Headers({
	// 			Authorization: `Bearer ${token}`,
	// 			"Content-Type": "application/json",
	// 		}),
	// 	});

	// 	if (!result.ok) {
	// 		throw new Error("Invalid token");
	// 	}

	// 	const user = (await result.json()).user;
	// 	return {
	// 		fullName: user.fullName,
	// 	}
	// }
}
