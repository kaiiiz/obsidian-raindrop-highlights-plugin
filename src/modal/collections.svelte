<script lang="ts">
	import type { SyncCollectionSettings } from "src/types";

    export let collections: SyncCollectionSettings = {};
	export let toggle: (id: number) => Promise<void>;
</script>

<div>
	{#each Object.entries(collections) as [id, collection]}
	<div>
		<input on:change={async () => toggle(collection.id)} type="checkbox" bind:checked={collection.sync}>
		<span>{collection.title}</span>
	</div>
	{/each}
</div>
