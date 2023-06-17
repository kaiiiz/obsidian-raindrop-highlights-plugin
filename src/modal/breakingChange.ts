import { App, Modal } from "obsidian";
import semver from "semver";

export default class BreadkingChangeModal extends Modal {
	public waitForClose: Promise<void>;
	private resolvePromise: () => void;

	constructor(app: App, currentVersion: string) {
		super(app);

		this.waitForClose = new Promise(
			(resolve) => (this.resolvePromise = resolve)
		);

		this.titleEl.innerText = "Raindrop Highlight - Breaking Changes";

		let breakingChanges = "";
		if (semver.lt(currentVersion, "0.0.18")) {
			breakingChanges += `<p>v0.0.18</p>
<ul>
<li>Date &amp; time format field is replaced by the <code>date</code> filter. Update <code>created</code> and <code>lastUpdate</code> in template accordingly.</li>
</ul>
`
		}

		if (breakingChanges !== "") {
			this.contentEl.innerHTML = breakingChanges;
			this.open();
		}
	}

	onClose() {
		super.onClose();
		this.resolvePromise();
	}
}
