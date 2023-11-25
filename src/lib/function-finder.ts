interface Op {
    run(): number;
    js(): string;
    cost(): number;
    normalize(): Op;
}

interface OpCtor {
    gen(gen: GetOps): Iterable<Op>;
    new (...args: any[]): Op;
}

type GetOps = () => Generator<Op, void, undefined>;

function makeGen(ops: OpCtor[], maxDepth: number) {
    return function* gen() {
        if (maxDepth > 0) {
            for (const op of ops) {
                yield* op.gen(makeGen(ops, maxDepth - 1));
            }
        }
    }
}

class Constant implements Op {
    static *gen() {
        yield new Constant(0);
    }
    constructor( private value: number, private  label?: string, private  cost_ = 0) {}
    run() {
        return this.value;
    }
    js() {
        return `${this.label ?? this.value}`
    }
    cost() {
        return this.cost_;
    }
    normalize(): Op {
        return this;
    }
}

function constant(value: number, label?: string, cost = 0): OpCtor {
    return class AConstant extends Constant {
        static override *gen() {
            yield new Constant(value, label, cost);
        }
    }
}

function input(name: string, mutable: {value: number}): OpCtor {
    return class Input implements Op {
        static name = name;
        static *gen() {
            yield new Input();
        }
        run() {
            return mutable.value;
        }
        js() {
            return `${name}`
        }
        cost() {
            return 1;
        }
        normalize(): Op {
            return this;
        }
    }
}

function one({run, js, cost = 2, normalize}: {
    run: (a: number) => number,
    js: (a: string) => string,
    cost?: number | undefined,
    normalize?: (a: Op) => Op,
}) {
    return class One implements Op {
        static *gen(gen: GetOps) {
            for (const a of gen()) {
                yield new One(a);
            }
        }
        constructor(public a: Op) {}
        run() {
            return run(this.a.run());
        }
        js() {
            return js(this.a.js?.());
        }
        cost() {
            return cost + this.a.cost();
        }
        normalize(): Op {
            if (this.a instanceof Constant) {
                return new Constant(this.run(), undefined, this.a.cost());
            }
            return normalize?.call(this, this.a.normalize()) ?? this;
        }
    }
}

function two({run, js, cost = 3, normalize}: {
    run: (a: number, b: number) => number,
    js: (a: string, b: string) => string,
    cost?: number | undefined,
    normalize?: (a: Op, b: Op) => Op,
}): OpCtor {
    return class Two implements Op {
        static *gen(gen: GetOps) {
            for (const a of gen()) {
                for (const b of gen()) {
                    yield new Two(a, b);
                }
            }
        }
        constructor(public a: Op, public b: Op) {}
        run() {
            return run(this.a.run(), this.b.run());
        }
        js() {
            return js(this.a.js?.(), this.b.js?.());
        }
        cost() {
            return cost + this.a.cost() + this.b.cost();
        }
        normalize(): Op {
            if (this.a instanceof Constant && this.b instanceof Constant) {
                return new Constant(this.run(), undefined, Math.max(this.a.cost(), this.b.cost()));
            }
            return normalize?.call(this, this.a.normalize(), this.b.normalize()) ?? this;
        }
    }
}

const Negate = one({
    run: (a) => -a,
    js: (a) => `-${a}`,
    normalize(a) {
        if (a instanceof Constant) {
            // debugger
            console.log('a instanceof Constant', a instanceof Constant, a.run(), -a.run())
            return new Constant(-a.run(), undefined, a.cost());
        }
        return new Negate(a);
    }
});

const Sub = two({
    run: (a, b) => a - b,
    js: (a, b) => `(${a} - ${b})`,
    cost: 1,
    normalize(a, b) {
        if (a instanceof Constant && b instanceof Constant) {
            return new Constant(a.run() - b.run(), undefined, Math.max(a.cost(), b.cost()));
        }
        return new Sub(a, b);
    }
});
const Add = two({
    run: (a, b) => a + b,
    js: (a, b) => `(${a} + ${b})`,
    cost: 1,
    normalize(a, b) {
        if (a instanceof Constant && a.run() < 0) {
            return new Sub(b, new Negate(a).normalize());
        }
        return new Add(a, b);
    }
});

function oneFn(fn: (a: number) => number, cost?: number) {
    return one({run: fn, js: (a) => `${fn.name}(${a})`, cost});
}

function twoFn(fn: (a: number, b: number) => number, cost?: number) {
    return two({run: fn, js: (a, b) => `${fn.name}(${a}, ${b})`, cost});
}

type Case = {inputs: number[], output: number};

const DEFAULT_OPS: OpCtor[] = [
    constant(1),
    constant(2),
    constant(3),
    constant(4),
    constant(5),

    Negate,

    Add,
    Sub,
    two({run: (a, b) => a * b, js: (a, b) => `(${a} * ${b})`, cost: 2}),
    two({run: (a, b) => a / b, js: (a, b) => `(${a} / ${b})`, cost: 4}),
    two({run: (a, b) => a % b, js: (a, b) => `(${a} % ${b})`, cost: 3}),

    two({run: (a, b) => a & b, js: (a, b) => `(${a} & ${b})`, cost: 2}),
    one({run: (a) => ~a, js: (a) => `~${a}`}),
    two({run: (a, b) => a | b, js: (a, b) => `(${a} | ${b})`, cost: 2}),
    two({run: (a, b) => a ^ b, js: (a, b) => `(${a} ^ ${b})`, cost: 2}),
    two({run: (a, b) => a << b, js: (a, b) => `(${a} << ${b})`, cost: 2}),
    two({run: (a, b) => a >> b, js: (a, b) => `(${a} >> ${b})`, cost: 2}),

    constant(Math.E, 'E', 1),
    constant(Math.LN10, 'LN10', 1),
    constant(Math.LN2, 'LN2', 1),
    constant(Math.LOG10E, 'LOG10E', 1),
    constant(Math.LOG2E, 'LOG2E', 1),
    constant(Math.PI, 'PI', 1),
    constant(Math.SQRT1_2, 'SQRT1_2', 1),
    constant(Math.SQRT2, 'SQRT2', 1),

    oneFn(Math.abs),
    oneFn(Math.acos, 4),
    oneFn(Math.acosh, 4),
    oneFn(Math.asin, 4),
    oneFn(Math.asinh, 4),
    oneFn(Math.atan, 6),
    oneFn(Math.atanh, 6),
    oneFn(Math.cbrt),
    oneFn(Math.ceil),
    oneFn(Math.clz32),
    oneFn(Math.cos, 4),
    oneFn(Math.cosh, 4),
    oneFn(Math.exp, 3),
    oneFn(Math.floor),
    oneFn(Math.log),
    oneFn(Math.log10),
    oneFn(Math.log2),
    oneFn(Math.round),
    oneFn(Math.sign),
    oneFn(Math.sin, 4),
    oneFn(Math.sinh, 4),
    oneFn(Math.sqrt, 4),
    oneFn(Math.tan, 5),
    oneFn(Math.tanh, 5),
    oneFn(Math.trunc),

    twoFn(Math.atan2, 4),
    twoFn(Math.hypot, 4),
    twoFn(Math.max, 4),
    twoFn(Math.min, 4),
    twoFn(Math.pow),
];
console.log('DEFAULT_OPS', DEFAULT_OPS)
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
export function findFunction(cases: Case[], maxDepth = 3) {
    const inputMutables = cases[0]?.inputs.map(value => ({value}));
    const inputOps = inputMutables?.map((mutable, index) => input(LETTERS[index]!, mutable));
    if (!inputMutables || !inputOps) throw new Error('No inputs provided');
    const ops = [...inputOps, ...DEFAULT_OPS];
    const gen = makeGen(ops, maxDepth);
    const opsGen = gen();

    // Ideally we need a way to have some sort of cost function
    // and maybe a way to tell if all of the inputs were used? I think this one can be opt in, since for the purposes I'm thinking I don't really care.

    function runOps() {
        let perLoop = 1000;
        while (perLoop--) {
            const {value, done} = opsGen.next();
            if (done) return;
            const op = value;
            let failed = false;
            op: for (const {inputs, output} of cases) {
                for (let i = 0; i < inputs.length; i++) {
                    inputMutables![i]!.value = inputs[i]!;
                }
                if (op.run() !== output) {
                    failed = true;
                    break op;
                }
            }
            if (!failed) {
                const normalized = op.normalize();
                const cost = normalized.cost();
                let code = expr(inputOps!, op);
                const normCode = expr(inputOps!, normalized);
                if (normCode !== code) {
                    code += ` -norm-> ${normCode}`;
                }
                console.info('PASS', `(cost ${cost}) ${code}`);
            }
        }
        setTimeout(runOps, 250);
    }

    runOps();
}

function expr(inputOps: OpCtor[], op: Op) {
    return `(${inputOps!.map((o) => o.name).join(', ')}) => ${op.js()}`;
}
