<script lang="ts">
	import { fade } from 'svelte/transition';
    import NumberArea from "./NumberArea.svelte";

    const worker = new Worker(new URL('../lib/bfff', import.meta.url), {type: "module"});
    const resultMap = new Map<string, number>();
    let uniqueResults: string[] = [];
    let failedExamples: string[] = [];
    let failed = 0;
    let status: 'invalid' | 'ready' | 'running' | 'paused';

    const MAX_RESULTS = 200;

    function reset() {
        resultMap.clear();
        uniqueResults = [];
        failedExamples = [];
        failed = 0;
    }

    function start() {
        if (status === 'invalid') throw new Error('Cannot run');
        if (status !== 'paused') {
            reset();
        }
        status = 'running';
        const cases = (output.validated as number[]).map((output, index) => {
            return {
                inputs: inputs.map(input => (input.validated as number[])[index]),
                output
            }
        });

        worker.postMessage({
            type: 'init',
            cases,
            maxDepth: 3,
        });
    }
    function stop() {
        status = 'paused';
    }
    worker.addEventListener('message', (e) => {
        if (status === 'running') {
            worker.postMessage({
                type: 'batch',
                count: 10000,
            });
        }
        switch (e.data.type) {
            case 'batch': {
                if (status === 'running' || status === 'paused') {
                    failed += e.data.failed;
                    let updates = false;
                    for (const result of e.data.results) {
                        if (!resultMap.has(result.code)) {
                            resultMap.set(result.code, result.cost);
                            updates = true;
                        }
                    }
                    if (updates) {
                        uniqueResults = Array.from(resultMap.entries())
                            .sort((a, b) => a[1] - b[1])
                            .map(([code]) => code)
                            .slice(0, MAX_RESULTS);
                    }
                    if (e.data.failedExamples?.length) {
                        failedExamples = e.data.failedExamples
                            .concat(failedExamples)
                            .slice(0, MAX_RESULTS);
                    }
                }
                break;
            }
        }
    });

    type InputValue = {text: string, validated: number[] | Error};
    let inputs: InputValue[] = [{text: '0\n1\n2\n3', validated: [0, 1, 2, 3]}];
    let output: InputValue = {text: '-1\n-1\n1\n1', validated: [-1, -1, 1, 1]};
    let errors: string[] = [];
    let warnings: string[] = [];
    let maxLines = 1;
    function countLines(input: InputValue) {
        return input.validated instanceof Error ? NaN : input.validated.length;
    }

    $: {
        const all = [...inputs, output];
        const counts = new Set(all.map(countLines));
        if (counts.size > 1) {
            warnings = ['Each column must have the same number of lines'];
        } else {
            warnings = [];
        }
        maxLines = Math.max(...counts);
        errors = Array.from(new Set(all.map((input) => input.validated)
                               .filter((v): v is Error => v instanceof Error)
                               .map((v) => v.message)));

        status = (errors.length === 0 && warnings.length === 0) ? 'ready' : 'invalid';
    }
    const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
</script>

<style>
    * {
        font-family: sans-serif;
    }
    h2 {
        font-size: 1.5em;
        margin: 1em 0 0.5em;
    }
    .editor {
        display: flex;
        flex-direction: row;
        gap: 1em;
    }
    .col {
        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: space-between;
    }
    .col h3 {
        margin: 0;
        padding: 0.5em 0;
        font-size: 1.5em;
        position: relative;
        font-family: monospace;
    }
    button.action {
        font-family: monospace;
        padding: 0;
        height: 1.2em;
        width: 1.2em;
        border-radius: 1em;
        line-height: 0;
        font-weight: bold;
        cursor: pointer;
    }
    button.delete {
        position: absolute;
        bottom: calc(-0.5em + -1px);
        right: calc(-0.5em + -1px);
        background: #fff;
        color: rgb(148, 8, 8);
        border-color: rgb(148, 8, 8);
    }
    button.delete:hover {
        background-color:  rgb(148, 8, 8);
        color: #fff;
    }
    button.add {
        background: #fff;
        color: rgb(8, 148, 31);
        border-color: rgb(8, 148, 31);
        align-self: center;
        margin-bottom: 1px;
    }
    button.add:hover {
        background-color:  rgb(8, 148, 31);
        color: #fff;
    }
    .problems {
        padding: 0;
        list-style: none;
    }
    .problems li {
        text-align: left;
        border-radius: 2px;
        padding: 0.3em 0.4em;
    }
    li.warning {
        background: rgb(255, 255, 107);
    }
    li.error {
        background: rgb(214, 90, 90);
        color: #fff;
    }

    /* https://cssloaders.github.io/ */
    .loader {
        width: 60px;
        height: 40px;
        position: relative;
        display: inline-block;
        --base-color: #fff; /*use your base color*/
    }
    .loader.active::before {
        content: '';
        left: 0;
        top: 0;
        position: absolute;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: #000;
        background-image: radial-gradient(circle 8px at 18px 18px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 18px 0px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 0px 18px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 36px 18px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 18px 36px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 30px 5px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 30px 5px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 30px 30px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 5px 30px, var(--base-color) 100%, transparent 0), radial-gradient(circle 4px at 5px 5px, var(--base-color) 100%, transparent 0);
        background-repeat: no-repeat;
        box-sizing: border-box;
        animation: rotationBack 3s linear infinite;
    }
    .loader.active::after {
        content: '';
        left: 35px;
        top: 15px;
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #000;
        background-image: radial-gradient(circle 5px at 12px 12px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 12px 0px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 0px 12px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 24px 12px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 12px 24px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 20px 3px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 20px 3px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 20px 20px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 3px 20px, var(--base-color) 100%, transparent 0), radial-gradient(circle 2.5px at 3px 3px, var(--base-color) 100%, transparent 0);
        background-repeat: no-repeat;
        box-sizing: border-box;
        animation: rotationBack 4s linear infinite reverse;
    }
    @keyframes rotationBack {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(-360deg);
        }
    }
    .results {
        display: flex;
        flex-direction: row;
        gap: 1em;
    }
    .passed, .failed {
        width: 50%;
    }
    .results pre {
        font-family: monospace;
        margin: 0;
        padding: 0.5em;
    }
    .results pre:nth-child(even) {
        background: #efefef;
    }
</style>

<h1>Brute Force Function Finder</h1>
<p>Enter a set of desired input and output values (numbers only!) and the BFFF will attempt to find a function to match.</p>
<p>WARNING: This is currently limited to a max expression depth of 3, but it will still run for a VERY long time. Also, it will generate a lot of silly functions. It will attempt to sort the simplest/cheapest to the top, but you're responsible for choosing and validating whatever it spits out.</p>

<div class="editor">
    {#each inputs as input, index}
        <div class="col input">
            <h3>
                {#if index === 0}({:else}&nbsp;{/if}{ALPHABET[index]}{#if index < inputs.length - 1},{:else}){/if}
                {#if index > 0}
                    <button class="action delete" on:click={() => inputs = [...inputs.slice(0, index), ...inputs.slice(index + 1)]}>−</button>
                {/if}
            </h3>
            <NumberArea bind:text={input.text} bind:validated={input.validated} warning={countLines(input) < maxLines} />
        </div>
    {/each}
    <div class="col">
        <h3>⇒</h3>
        <button class="action add" on:click={() => inputs = [...inputs, {text: '', validated: []}]}>+</button>
    </div>
    <div class="col">
        <h3>out</h3>
        <NumberArea bind:text={output.text} bind:validated={output.validated} warning={countLines(output) < maxLines} />
    </div>
    <div class="col control">
        <div class="loader" class:active={status === 'running'}></div>
        {#if status === 'running'}
            <button on:click={stop}>Pause</button>
        {:else}
            <button disabled={status === 'invalid'} on:click={start}>{status === 'paused' ? 'Resume' : 'Start'}</button>
        {/if}
    </div>
</div>

<ul class="problems">
    {#each errors as error}
        <li class="error">{error}</li>
    {/each}
    {#if !errors.length}
        {#each warnings as warning}
            <li class="warning">{warning}</li>
        {/each}
    {/if}
</ul>

<div class="results">
    <div class="passed">
        <h2>Passed</h2>
        {#if uniqueResults.length > 0}
            <p>{#if uniqueResults.length === MAX_RESULTS}The top{/if} {uniqueResults.length} successful attempts (by estimated cost)</p>
        {:else if status === 'running'}
            <p>Loading...</p>
        {:else}
            <p>Start a new run to get results</p>
        {/if}

        <div>
            {#each uniqueResults as result}
                <pre in:fade={{duration: 1000}}>{result}</pre>
            {/each}
        </div>
    </div>

    <div class="failed">
        <h2>Failed</h2>
        {#if failed}
            <p>{failedExamples.length} examples from {failed} total failed attempts</p>
        {:else}
            <p>None yet!</p>
        {/if}
        <div>
            {#each failedExamples as failed}
                <pre in:fade={{duration: 1000}}>{failed}</pre>
            {/each}
        </div>
    </div>
</div>
