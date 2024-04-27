import { assert } from 'chai';

import {
    range,
    flatten_iterable,
    iterable_extension,
    expand_iterable_bounded,
    chain,
    repeat,
    default_max_iterations,
    zip,
    zip_longest,
    iterable_extension_handler_functions_keys,
} from '../../build/lib/sys/iterable-util.js';


for (const range_args of [
    [],
    [5],
    [3, 5],
    [5, 5, true],
    [5, 3],
    [5, 3, true],
    [5, 3, 0.5],
    [5, 3, -0.5],
    [5, 3, { inclusive: true, increment: 0.5 }],
]) {
    let start, limit, increment=1, inclusive=false;
    if (range_args.length == 0) {
        start = limit = 0;
    } else if (range_args.length == 1) {
        start = 0;
        limit = range_args[0];
    } else if (range_args.length == 2) {
        start = range_args[0];
        limit = range_args[1];
    } else {
        start = range_args[0];
        limit = range_args[1];
        const arg2 = range_args[2];
        if (typeof arg2 === 'number') {
            increment = arg2;
        } else if (typeof arg2 === 'boolean') {
            inclusive = arg2;
        } else {
            ({ increment=1, inclusive=false } = arg2);
        }
    }

    describe(`range(${JSON.stringify(range_args).slice(1, -1)})`, function () {
        const range_iterator_key_value = range.apply(null, range_args)[Symbol.iterator];
        describe('value of Symbol.iterator key', function () {
            it('should be a function', function () {
                assert.isFunction(range_iterator_key_value);
            });
            it('should require no arguments', function () {
                assert.equal(range_iterator_key_value.length, 0);
            });
        });

        const range_iterator = range_iterator_key_value();
        describe('iterator returned from value of Symbol.iterator key', function () {
            const reverse = (start > limit);
            const nonterminating = (increment == 0) || ((increment < 0) === reverse);
            let loops = 0;
            for ( let i = start;
                  reverse ? (inclusive ? (i >= limit) : (i > limit)) : (inclusive ? (i <= limit) : (i < limit));
                  reverse ? i-=increment : i+=increment
                ) {
                if (nonterminating) {
                    if (loops++ >= 20) {
                        break;
                    }
                }
                it(`should produce ${i} when .next() is called`, function () {
                    const r = range_iterator.next();
                    assert.equal(typeof r, 'object');
                    assert.equal(r.value, i);
                    assert.isUndefined(r.done);
                });
            }
            if (!nonterminating) {
                for (let i = 0; i < 2; i++) {
                    it(`should indicate done with no value when .next() is called`, function () {
                        const r = range_iterator.next();
                        assert.isObject(r);
                        assert.isUndefined(r.value);
                        assert.equal(r.done, true);
                    });
                }
            }
        });
    });
}

for (const [ range_args, intended_results ] of [
    [[[]],       [[]]],
    [[[], true], [[]]],
    [[['ab', 'cd']],       [['a','c'], ['b','c'], ['a','d'], ['b','d']]],
    [[['ab', 'cd'], true], [['a','c'], ['a','d'], ['b','c'], ['b','d']]],
    [[['ab', '', 'cd']], [['a',undefined,'c'], ['b',undefined,'c'], ['a',undefined,'d'], ['b',undefined,'d']]],
    [[['ab', 'x', 'cd']], [['a','x','c'], ['b','x','c'], ['a','x','d'], ['b','x','d']]],
]) {
    describe(`range(${JSON.stringify(range_args).slice(1, -1)})`, function () {
        describe('sequence', function () {
            it(`should produce ${JSON.stringify(intended_results).slice(1, -1)}`, function () {
                const results = [ ...range.apply(null, range_args) ];
                assert.deepEqual(results, intended_results);
            });
        });
    });
}

describe(`range(15).some(fn)`, function () {
    describe('with fn = x => x<10', function () {
        it(`should return true`, function () {
            assert.equal(range(15).some(x => x<10), true);
        });
    });
});

describe(`range(15).some(fn)`, function () {
    describe('with fn = x => x>15', function () {
        it(`should return false`, function () {
            assert.equal(range(15).some(x => x>15), false);
        });
    });
});

describe(`range(15).every(fn)`, function () {
    describe('with fn = x => x<10', function () {
        it(`should return true`, function () {
            assert.equal(range(15).every(x => x<10), false);
        });
    });
});

describe(`range(15).every(fn)`, function () {
    describe('with fn = x => x<15', function () {
        it(`should return false`, function () {
            assert.equal(range(15).every(x => x<15), true);
        });
    });
});

describe(`range(15).for_each(fn)`, function () {
    describe('with fn = x => outputs.push(x)', function () {
        const outputs = [];
        const rng = range(15);
        const rng_values = [ ...rng ];
        rng.for_each(x => outputs.push(x));
        it(`should populate outputs with the original range values (${rng_values})`, function () {
            assert.deepEqual(outputs, rng_values);
        });
    });
});


/*

println('-------');
println(JSON.stringify([ ...zip(range(15), range(100, 110), range(200, 207)) ]));
println(JSON.stringify([ ...zip_longest(range(15), range(100, 110), range(200, 207)) ]));
println();

println('-------');
println(range(10, 13).reduce((acc, v) => acc+v));
println(range(10, 13).reduce((acc, v) => acc+v, 100));
println();

println('-------');
println(JSON.stringify([ ...range(['ab', 'xy']).map(e => e.join('')).enumerate() ]));
println();

println('-------');
println(JSON.stringify([ ...range(5).map(x => ({ value: `k${x}` })) ]));
println(JSON.stringify([ ...range(5).map(x => ({ value: `k${x}` })).pluck('value') ]));
println();

println('-------');
println(range(5).tap(println).reduce((acc, v) => acc+v));
println();

println('-------');
println(JSON.stringify(range(5)));
println(JSON.stringify(range(5).to_array()));
println();

println('-------');
function make_sequence_with_duplicates() {
    return chain(
        zip(range(5), range(5), range(5)).flat(1),
        range([[Math.log]]).flat(1),
        range(100, 105),
        [Math.log],
        zip(range(6), range(6), range(6)).flat(1)
    );
}
println(JSON.stringify(make_sequence_with_duplicates().to_array()));
println(make_sequence_with_duplicates().map(x => x.toString()).join());
println(make_sequence_with_duplicates().unique().map(x => x.toString()).join());
println();

println('-------');
println(JSON.stringify(range(5).map(x => x&1 ? [x, 2*x] : []).to_array()));
println(JSON.stringify(range(5).flat_map(x => x&1 ? [x, 2*x] : []).to_array()));
println();

println('-------');
println(JSON.stringify(range(5).map(x => ({ a: x, b: 2*x })).to_array()));
println(JSON.stringify(range(5).map(x => ({ a: x, b: 2*x })).find(o => (o.b === 4))));
println(`${range(5).map(x => ({ a: x, b: 2*x })).find(o => (o.b === 5))}`);
println();

println('-------');
println(JSON.stringify(range(0, 5, 0.5).to_array()));
println();

println('-------');
r = range(1, 10, true).map(Math.log).chunk(3);
println(JSON.stringify(r.to_array()));
println(JSON.stringify(r.to_array()));
println(JSON.stringify(r.to_array()));

println('-------');
const [r1, r2, r3] = range(5).map(x => x**2).map(x => x+1).tee(3);
printf('r1: %j\n', r1.to_array());
printf('r2: %j\n', r2.to_array());
printf('r3: %j\n', r3.to_array());
printf();

println('-------');
const z = zip(range(5), range(10, 15), range(20, 25));
printf('z: %j\n', z.to_array());
const [i1, i2, i3] = z.unzip(3);
printf('i1: %j\n', i1.to_array());
printf('i2: %j\n', i2.to_array());
printf('i3: %j\n', i3.to_array());
printf();

println('-------');
println(JSON.stringify(iterable_extension_handler_functions_keys, null, 4));
println();
*/
