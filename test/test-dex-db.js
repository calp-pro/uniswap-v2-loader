const fs = require('fs')
const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('../src/index')
const default_cache_filename = require('../src/default_cache_filename')
const dump = require('path').join(__dirname, 'dump')
const factory = '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f'
const filename = default_cache_filename(factory)

describe('Uniswap V2 binary', () => {

    it('Load first 3 pairs and store at default "dump*.bin" files', () =>
        load({
            factory,
            csv: false,
            to: 2
        })
        .then(pairs => {
            assert.equal(pairs.length, 3, 'Should be 3 pairs')
            assert.equal(pairs[0].id, 0, 'First pairs should be 0')
            assert.equal(pairs[1].id, 1, 'First pairs should be 1')
            assert.equal(pairs[2].id, 2, 'First pairs should be 2')
            const {pair, token0, token1} = pairs[1]
            // Return format should be standardized between Ethereum nodes which
            // can return address in lower-case and mix-case formats
            // Lower-case format guarantee matching addresses with == operator 
            assert.equal(pair, '0x3139ffc91b99aa94da8a2dc13f1fc36f9bdc98ee')
            assert.equal(token0, '0x8e870d67f660d95d5be530380d0ec0bd388289e1')
            assert.equal(token1, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
        })
    )

    it('Use default "dump*.bin" and load one more pair', () =>
        load({
            factory,
            csv: false,
            to: 3
        })
        .then(pairs => {
            assert.equal(pairs.length, 4, 'Should be 4 pairs')
        })
    )
    
    after(() => {
        fs.unlinkSync(filename + '_pairs.bin')
        fs.unlinkSync(filename + '_tokens.bin')
        fs.unlinkSync(filename + '_p2tt.bin')
    })

})





