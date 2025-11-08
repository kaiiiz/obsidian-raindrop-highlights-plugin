import { App, Modal, Notice } from "obsidian";
import type { RaindropAPI } from "src/api";
import ApiTokenModalContent from "./apiTokenModal.svelte";
import { mount, unmount } from "svelte";

export default class ApiTokenModal extends Modal {
	public waitForClose: Promise<void>;
	private resolvePromise: () => void = () => {};
	private modalContent: ReturnType<typeof mount>;
	private api: RaindropAPI;

	constructor(app: App, api: RaindropAPI) {
		super(app);

		this.api = api;
		this.waitForClose = new Promise(
			(resolve) => (this.resolvePromise = resolve)
		);

		this.titleEl.innerText = "Enter Raindrop.io API token";

		this.modalContent = mount(ApiTokenModalContent, {
			target: this.contentEl,
			props: {
				onSubmit: async (value: string) => {
					try {
						await this.api.checkToken(value);
					} catch (e) {
						if (e instanceof Error) {
							new Notice(e.message);
						} else {
							console.error("Unknown error", e);
						}
						return;
					}

					this.api.tokenManager.set(value);
					this.close();
				},
			},
		});

		this.open();
	}

	onClose() {
		super.onClose();
		unmount(this.modalContent);
		this.resolvePromise();
	}
}
