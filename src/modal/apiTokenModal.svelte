<script lang="ts">
	export let onSubmit: (value: string) => void;
	let tokenInput: HTMLInputElement;
</script>

<div class="setting-item">
	<div class="setting-item-info">
		<div class="setting-item-name">Raindrop.io API Token</div>
		<div class="setting-item-description">
			<span>Log into your <a href="https://app.raindrop.io/settings/integrations">Developer Settings</a> to get your "Test token".</span>
		</div>
</div>

</div>
	<div class="setting-item-info">
	<input bind:this={tokenInput} type="text" placeholder="API token" size="40" />
	<button class="mod-cta" style="float: right" on:click={()=> onSubmit(tokenInput.value)}>Save</button>
</div>
