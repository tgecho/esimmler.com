<script>
    import {findFunction} from '../lib/function-finder.ts';
    // findFunction([
    //     {inputs: [0], output: -1},
    //     {inputs: [1], output: 1},
    //     {inputs: [2], output: -1},
    //     {inputs: [3], output: 1},
    // ])
    findFunction([
        {inputs: [0], output: -1},
        {inputs: [1], output: -1},
        {inputs: [2], output: 1},
        {inputs: [3], output: 1},
    ])
</script>

<div>Hello world!!!!</div>


PASS (a) => ((a - 3) + (a ^ 2))
function-finder.ts:151 PASS (a) => ((a - 3) + (2 ^ a))
function-finder.ts:151 PASS (a) => ((a ^ 2) + (a - 3))
function-finder.ts:151 PASS (a) => ((2 ^ a) + (a - 3))
