interface Fun {
  run(): number;
  js(): string;
  cost(): number;
  normalize(): Fun;
  hasInput(): boolean;
}

interface FunFactory {
  gen(gen: GetFun): Iterable<Fun>;
  new (...args: any[]): Fun;
}

type GetFun = () => Generator<Fun, void, undefined>;

function createFunGenerator(funFactories: FunFactory[], maxDepth: number) {
  return function* gen() {
    if (maxDepth > 0) {
      for (const factory of funFactories) {
        yield* factory.gen(createFunGenerator(funFactories, maxDepth - 1));
      }
    }
  };
}

class Constant implements Fun {
  static *gen() {
    yield new Constant(0);
  }
  constructor(
    private value: number,
    private label?: string,
    private cost_ = 0,
  ) {}
  run() {
    return this.value;
  }
  js() {
    return `${this.label ?? this.value}`;
  }
  cost() {
    return this.cost_;
  }
  hasInput() {
    return false;
  }
  normalize(): Fun {
    return this;
  }
}

function isConstant(fun: Fun, value?: number): boolean {
  if (fun instanceof Constant) {
    if (value === undefined) return true;
    return fun.run() === value;
  }
  return false;
}

function constant(value: number, label?: string, cost = 0): FunFactory {
  return class AConstant extends Constant {
    static override *gen() {
      yield new Constant(value, label, cost);
    }
  };
}

type InputFunFactory = FunFactory & { set(value: number): void };

function input(name: string): InputFunFactory {
  let value = 0;
  return class Input implements Fun {
    static name = name;
    static *gen() {
      yield new Input();
    }
    static set(update: number) {
      value = update;
    }
    run() {
      return value;
    }
    hasInput() {
      return true;
    }
    js() {
      return `${name}`;
    }
    cost() {
      return 1;
    }
    normalize(): Fun {
      return this;
    }
  };
}

function one({
  run,
  js,
  cost = 2,
  normalize,
}: {
  run: (a: number) => number;
  js: (a: string) => string;
  cost?: number | undefined;
  normalize?: (a: Fun) => Fun;
}) {
  return class One implements Fun {
    static *gen(gen: GetFun) {
      for (const a of gen()) {
        yield new One(a);
      }
    }
    constructor(public a: Fun) {}
    run() {
      return run(this.a.run());
    }
    js() {
      return js(this.a.js?.());
    }
    cost() {
      return cost + this.a.cost();
    }
    hasInput() {
      return this.a.hasInput();
    }
    normalize(): Fun {
      if (isConstant(this.a)) {
        return new Constant(this.run(), undefined, this.a.cost());
      }
      return normalize?.call(this, this.a.normalize()) ?? this;
    }
  };
}

function two({
  run,
  js,
  cost = 3,
  normalize,
}: {
  run: (a: number, b: number) => number;
  js: (a: string, b: string) => string;
  cost?: number | undefined;
  normalize?: (a: Fun, b: Fun) => Fun;
}): FunFactory {
  return class Two implements Fun {
    static *gen(gen: GetFun) {
      for (const a of gen()) {
        for (const b of gen()) {
          yield new Two(a, b);
        }
      }
    }
    constructor(
      public a: Fun,
      public b: Fun,
    ) {}
    run() {
      return run(this.a.run(), this.b.run());
    }
    js() {
      return js(this.a.js?.(), this.b.js?.());
    }
    cost() {
      return cost + this.a.cost() + this.b.cost();
    }
    hasInput() {
      return this.a.hasInput() || this.b.hasInput();
    }
    normalize(): Fun {
      if (isConstant(this.a) && isConstant(this.b)) {
        return new Constant(
          this.run(),
          undefined,
          Math.max(this.a.cost(), this.b.cost()),
        );
      }
      return (
        normalize?.call(this, this.a.normalize(), this.b.normalize()) ?? this
      );
    }
  };
}

function oneFn(fn: (a: number) => number, cost?: number) {
  return one({ run: fn, js: a => `${fn.name}(${a})`, cost });
}

function twoFn(fn: (a: number, b: number) => number, cost?: number) {
  return two({ run: fn, js: (a, b) => `${fn.name}(${a}, ${b})`, cost });
}

const Negate = one({
  run: a => -a,
  js: a => `-${a}`,
  normalize(a) {
    if (isConstant(a)) {
      return new Constant(-a.run(), undefined, a.cost());
    }
    if (a instanceof Negate) {
      return a.a;
    }
    return new Negate(a);
  },
});

const Sub = two({
  run: (a, b) => a - b,
  js: (a, b) => `(${a} - ${b})`,
  cost: 1,
  normalize(a, b) {
    if (isConstant(a) && isConstant(b)) {
      return new Constant(
        a.run() - b.run(),
        undefined,
        Math.max(a.cost(), b.cost()),
      );
    }
    if (isConstant(b, 0)) {
      return a;
    }
    return new Sub(a, b);
  },
});
const Add = two({
  run: (a, b) => a + b,
  js: (a, b) => `(${a} + ${b})`,
  cost: 1,
  normalize(a, b) {
    if (isConstant(a) && a.run() < 0) {
      return new Sub(b, new Negate(a).normalize());
    }
    if (isConstant(b) && !isConstant(b)) {
      return new Add(b, a);
    }
    if (isConstant(a, 0)) {
      return b;
    }
    if (isConstant(b, 0)) {
      return a;
    }
    return new Add(a, b);
  },
});
const Mult = two({
  run: (a, b) => a * b,
  js: (a, b) => `(${a} * ${b})`,
  cost: 2,
  normalize(a, b) {
    if (isConstant(a, 1)) {
      return b;
    }
    if (isConstant(b, 1)) {
      return a;
    }
    return new Mult(a, b);
  },
});
const Div = two({
  run: (a, b) => a / b,
  js: (a, b) => `(${a} / ${b})`,
  cost: 2,
  normalize(a, b) {
    if (isConstant(b, 1)) {
      return a;
    }
    return new Mult(a, b);
  },
});

type Case = { inputs: number[]; output: number };

const DEFAULT_FUNS: FunFactory[] = [
  constant(1),
  constant(2),
  // These don't seem to add much value
  // constant(3),
  // constant(4),
  // constant(5),
  // constant(6),
  // constant(7),
  // constant(8),
  // constant(9),
  // constant(10),
  // constant(0.1),
  // constant(0.2),
  // constant(0.25),
  // constant(0.3),
  // constant(0.4),
  // constant(0.5),
  // constant(0.6),
  // constant(0.7),
  // constant(0.75),
  // constant(0.8),
  // constant(0.9),
  // constant(0),

  Negate,
  Add,
  Sub,
  Mult,
  Div,
  two({ run: (a, b) => a % b, js: (a, b) => `(${a} % ${b})`, cost: 3 }),

  two({ run: (a, b) => a & b, js: (a, b) => `(${a} & ${b})`, cost: 2 }),
  one({ run: a => ~a, js: a => `~${a}` }),
  two({ run: (a, b) => a | b, js: (a, b) => `(${a} | ${b})`, cost: 2 }),
  two({ run: (a, b) => a ^ b, js: (a, b) => `(${a} ^ ${b})`, cost: 2 }),
  two({ run: (a, b) => a << b, js: (a, b) => `(${a} << ${b})`, cost: 2 }),
  two({ run: (a, b) => a >> b, js: (a, b) => `(${a} >> ${b})`, cost: 2 }),

  // These don't seem to add much value
  constant(Math.E, "E", 1),
  // constant(Math.LN10, "LN10", 1),
  // constant(Math.LN2, "LN2", 1),
  // constant(Math.LOG10E, "LOG10E", 1),
  // constant(Math.LOG2E, "LOG2E", 1),
  constant(Math.PI, "PI", 1),
  // constant(Math.SQRT1_2, "SQRT1_2", 1),
  // constant(Math.SQRT2, "SQRT2", 1),

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

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function generateInputs(cases: Case[]) {
  const inputs = cases[0]?.inputs?.map((_, index) => input(LETTERS[index]!));
  if (!inputs) throw new Error("No inputs provided");
  for (const c of cases) {
    if (c.inputs.length !== inputs.length) {
      throw new Error("Each case must have the same number inputs");
    }
  }
  return inputs;
}

export type FunResult = { fun: Fun; code: string; cost: number };
export type FunBatchResult = {
  done: boolean;
  failedTotal: number;
  failedExamples: string[];
  results: FunResult[];
};

export class FunctionFinder {
  private inputFactories: InputFunFactory[];
  private funs: Generator<Fun, void, undefined>;

  constructor(
    private cases: Case[],
    maxDepth = 3,
  ) {
    this.inputFactories = generateInputs(cases);
    const funFactories = [...this.inputFactories, ...DEFAULT_FUNS];
    const funGenerator = createFunGenerator(funFactories, maxDepth);
    this.funs = funGenerator();
  }

  batch(count = 50000): FunBatchResult {
    let done = false;
    let failedTotal = 0;
    const failedExamples = [];
    const results = [];
    while (count--) {
      const next = this.funs.next();
      if (next.done) {
        done = true;
        break;
      }
      const fun = next.value;
      if (!fun.hasInput()) continue;
      let failed = false;
      fun: for (const { inputs, output } of this.cases) {
        for (let i = 0; i < inputs.length; i++) {
          this.inputFactories![i]!.set(inputs[i]!);
        }
        if (fun.run() !== output) {
          // console.log('failed', fun.js());
          failedTotal += 1;
          if (Math.random() < 0.0005) {
            failedExamples.push(expr(this.inputFactories, fun.normalize()));
          }
          failed = true;
          break fun;
        }
      }
      if (!failed) {
        const normalized = fun.normalize();
        results.push({
          fun: normalized,
          code: expr(this.inputFactories, normalized),
          cost: normalized.cost(),
        });
      }
    }
    return { done, results, failedTotal, failedExamples };
  }
}

export async function findFunctions(cases: Case[], maxDepth = 3) {
  const finder = new FunctionFinder(cases, maxDepth);

  function getSome() {
    const { done, results, failedTotal: failed } = finder.batch();
    console.log(`Failed: ${failed}`);
    if (results.length) {
      results.forEach(r => console.log(r.code, r.cost));
    }
    if (done) {
      console.log("done");
      return;
    } else {
      setTimeout(getSome, 200);
    }
  }

  getSome();
}

function expr(inputFuns: FunFactory[], op: Fun) {
  let js = op.js();
  if (js.at(0) === "(" && js.at(-1) === ")") js = js.slice(1, -1);
  return `(${inputFuns!.map(o => o.name).join(", ")}) => ${js}`;
}

export type WorkerMessage =
  | { type: "start"; cases: Case[]; maxDepth: number }
  | { type: "batch"; count: number };
export type WorkerResponse =
  | { type: "started"; error?: string }
  | ({ type: "result" } & FunBatchResult);

if (
  // @ts-ignore
  typeof self.WorkerGlobalScope !== "undefined" &&
  // @ts-ignore
  self instanceof self.WorkerGlobalScope
) {
  let finder: FunctionFinder;
  self.addEventListener("message", ev => {
    switch (ev.data.type) {
      case "init": {
        try {
          finder = new FunctionFinder(ev.data.cases, ev.data.maxDepth);
          self.postMessage({ type: "ready" });
        } catch (err) {
          self.postMessage({ type: "error", error: String(err) });
        }
        break;
      }
      case "batch": {
        const {
          done,
          results,
          failedTotal: failed,
          failedExamples,
        } = finder?.batch(ev.data.count);
        self.postMessage({
          type: "batch",
          done,
          results: results.map(r => ({ code: r.code, cost: r.cost })),
          failed,
          failedExamples,
        });
        break;
      }
    }
  });
}
