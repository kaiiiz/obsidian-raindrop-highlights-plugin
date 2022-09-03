export default class TokenManager {
	get(): string|null {
		const token = window.localStorage.getItem('raindrop_token');

		if (token === null || token.length == 0) {
			return null;
		}

		return token;
	}

	set(token: string) {
		window.localStorage.setItem('raindrop_token', token);
	}

	clear() {
		window.localStorage.removeItem('raindrop_token');
	}
}
