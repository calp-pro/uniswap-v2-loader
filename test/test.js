const fs = require('fs')
const { describe, before, it } = require('node:test')
const assert = require('node:assert/strict')
const {load, subscribe} = require('../src/index')
const default_cache_filename = require('../src/default_cache_filename')

describe('Uniswap V2', () => {
    const uniswap_v2_factory = '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f'
    const uniswap_v2_cache_filename = default_cache_filename(uniswap_v2_factory) + '.csv'

    before(() => {
        if (fs.existsSync(uniswap_v2_cache_filename))
            fs.unlinkSync(uniswap_v2_cache_filename)
    })
    
    it('Exist USDC/USDP pair', () =>
        load({to: 2})
        .then(pairs => {
            assert.equal(pairs.length, 3, 'Should be 3 pairs with ids: 0, 1, 2')
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

    it('Re-load first three pairs to custom CSV file', () => {
        // If user specify a filename then
        // a cache data will be taken from
        // the filename provided. If file is empty then
        // data will be uploaded again from network then
        // new file would be created and data would be stored.
        const filename = Date.now() + '.csv'
        return load({to: 2, filename})
        .then(() => {
            const lines = fs.readFileSync(filename).toString().trim().split('\n')
            assert.equal(lines.length, 3, 'if "to" is 2 then 0,1,2 should be loaded')
        })
        .finally(() => {
            fs.unlinkSync(filename)
        })
    })

    it('.subscribe should call provided callback with all 3 pairs (0,1,2 - ids) for a current moment (from cache)', () =>
        new Promise(y => {
            const unsubscribe = subscribe(pairs => {
                assert.equal(pairs.length, 3)
                unsubscribe()
                y()
            }, {to: 2})
        })
    )

    it('Multi-core test 2 workers load 2 pools using multicall', () =>
        // There are already 3 pools loaded from previous test
        // 7 - 3 = 4. Rest 4 will be loaded by 2 workers. Each load 2.
        // Multicall size is 2.
        load({to: 6, multicall_size: 2, workers: 2})
        .then(pairs => {
            assert.equal(pairs.length, 7)
        })
    )
    
    it('No multi-core. Same process load +3 pairs', () =>
        load({to: 6 + 3, workers: 0})
        .then(pairs => {
            assert.equal(pairs.length, 10)
            assert.equal(pairs[8].pair, '0xb6909b960dbbe7392d405429eb2b3649752b4838', 'Brave token BAT to WETH')
        })
    )

    it('Each line at CSV cache file should be orderd by pair id (factory id)', () => {
        const lines = fs.readFileSync(uniswap_v2_cache_filename, 'utf8').trim().split('\n')
        for (var i = 0; i < lines.length; i++)
            assert.equal(i, +lines[i].split(',').shift())
    })
    
    it('Loading 10 pairs (ids: [0-9]) each pair should be call "progress" - 10 calls', () => {
        var progress_call_count = 0
        load({
            to: 9,
            workers: 0,
            progress: () => progress_call_count++
        })
        .then(() => {
            assert.equal(progress_call_count, 10)
        })
    })

    it('Graceful shutdown after +1 pair loaded', () => {
        const abort_controller = new AbortController()
        const abort_signal = abort_controller.signal
        var once = true

        return load({
            workers: 0,
            progress: () => {
                if (once) {
                    onece = false
                    setTimeout(() => abort_controller.abort(), 0)
                }
            },
            abort_signal
        })
    })

    it('Graceful shutdown after +1 pair loaded (main process send "abort" message to worker)', () => {
        const abort_controller = new AbortController()
        const abort_signal = abort_controller.signal
        var once = true
        
        return load({
            workers: 1,
            progress: () => {
                if (once) {
                    onece = false
                    setTimeout(() => abort_controller.abort(), 0)
                }
            },
            abort_signal
        })
    })

    it('Should load only id 487004 (TOTO/WETH) where token1 is 42 chars length', () => {
        return load({
            workers: 0,
            from: 487004,
            to: 487004
        })
        .then(pairs => {
            assert.equal(pairs[0].token1.length, 42)
        })
    })
})





