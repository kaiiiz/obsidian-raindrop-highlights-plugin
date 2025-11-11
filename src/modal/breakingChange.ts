import { App, Modal } from "obsidian";
import semver from "semver";

export default class BreadkingChangeModal extends Modal {
	constructor(app: App, currentVersion: string) {
		super(app);

		this.titleEl.innerText = "Raindrop Highlight - Breaking Changes";

		let breakingChanges = "";
		if (semver.lt(currentVersion, "0.0.21")) {
			breakingChanges += `<p>v0.0.21</p>
<ul>
<li>Sync collections from last update time is now changed to sync from created time. You should now use either \`Raindrop Highlights: Sync all bookmarks (full sync)\` or \`Raindrop Highlights: Sync this bookmark\` command to update existing files. See issue <a href="https://github.com/kaiiiz/obsidian-raindrop-highlights-plugin/issues/72">#72</a> for details.</li>
</ul>
`;
		}

		if (semver.lt(currentVersion, "0.0.19")) {
			breakingChanges += `<p>v0.0.19</p>
<ul>
<li>The front matter property <code>raindrop_last_update</code> has now been replaced by <code>raindrop_highlights</code>, which stores the highlight signature for each highlight entry to fix the duplicate highlight entry bug in append mode.</li>
<li>The file name and front matter are now synced with templates while performing updates.</li>
</ul>
`;
		}

		if (semver.lt(currentVersion, "0.0.18")) {
			breakingChanges += `<p>v0.0.18</p>
<ul>
<li>Date &amp; time format field is replaced by the <code>date</code> filter in template. Update <code>created</code> and <code>lastUpdate</code> in template accordingly.</li>
</ul>
`;
		}

		if (breakingChanges !== "") {
			this.contentEl.innerHTML = breakingChanges;
			this.open();
		}
	}

	onClose() {
		super.onClose();
	}
}
