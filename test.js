const { test } = require('node:test');
const assert = require('node:assert/strict');
const uniswap_v2_loader = require('./index')

test('Exist USDC/USDP pair', () =>
    uniswap_v2_loader.all().then(pairs => {
        assert.ok(pairs.length > 0)
        const i = pairs.findIndex(({id}) => id == 1)
        assert.ok(i != -1)
        if (i != -1) {
            const {pair, token0, token1} = pairs[i]
            assert.equal(pair, '0x3139ffc91b99aa94da8a2dc13f1fc36f9bdc98ee')
            assert.equal(token0, '0x8e870d67f660d95d5be530380d0ec0bd388289e1')
            assert.equal(token1, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
        }
    })
)
