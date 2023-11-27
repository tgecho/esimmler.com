<script lang="ts">
    export let text = '';
    export let validated: number[] | Error = [];
    export let warning: boolean = false;
    let cols = 4;
    let rows = 2;
    $: {
        const lines = text.split('\n');
        cols = Math.max(4, ...lines.map((line) => line.length));
        rows = Math.max(2, lines.length);

        // Ignore a trailing empty line when validating
        if (lines.at(-1) === '') lines.length -= 1;
        const numbers = lines.map(Number);
        if (numbers.some(isNaN)) {
            validated = new Error('Each line must be a number');
        } else {
            validated = numbers;
        }
    }
</script>

<style>
    textarea {
        resize: none;
        overflow: hidden;
        flex: 1;
        line-height: 16px;
        background: repeating-linear-gradient(
            180deg,
            #fff,
            #fff 16px,
            #efefef 16px,
            #efefef 32px
        );
        background-position: 0 2px;
        padding: 2px;
        border: 1px solid #999;
    }
    .warning {
        background: rgb(255, 255, 107);
    }
    .error {
        background: rgb(255, 107, 107);
    }
</style>

<textarea tabindex="1" {rows} {cols} class:warning={warning} class:error={validated instanceof Error} bind:value={text}></textarea>
