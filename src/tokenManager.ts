export default class TokenManager {
	localStorage: any;

	constructor() {
		this.localStorage = window.localStorage;
	}

	get(): string|null {
		const token = this.localStorage.getItem('raindrop_token');

		if (token === null || token.length == 0) {
			return null;
		}

		return token;
	}

	set(token: string) {
		this.localStorage.setItem('raindrop_token', token);
	}
}
