<script lang="ts">
	import type { SyncCollection } from "src/types";

	export let collections: [string, SyncCollection][] = [];
	export let toggle: (id: number) => Promise<void>;
</script>

<div>
	{#each collections as [id, collection]}
	<div class="collection-entry">
		<input on:change={async () => toggle(collection.id)} type="checkbox" bind:checked={collection.sync}>
		<span>{collection.title}</span>
	</div>
	{/each}
</div>
