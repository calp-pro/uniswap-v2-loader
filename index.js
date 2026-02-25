const cluster = require('cluster')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { parseAbiItem, createPublicClient, http } = require('viem')
const { mainnet } = require('viem/chains')
const default_filename = require('./default_cache_filename')
const workers = os.cpus().length - 1
const missed = Array(workers).fill(null).map(() => [])
const key = process.env.KEY || 'FZBvlPrOxtgaKBBkry3SH0W1IqH4Y5tu'
const factory = '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f'
const client = createPublicClient({
    chain: mainnet,
    transport: http('https://eth-mainnet.g.alchemy.com/v2/' + key)
})

const load = params => {
    const {filename = default_filename, to, from = 0, multicall_size = 50, progress, count, multicore = true} = params
    const pairs = params.pairs || fs.existsSync(filename)
        ? fs.readFileSync(filename).toString().trim().split('\n')
            .reduce((pairs, line) => {
                line = line.split(',')
                if (line[0] == '') return pairs
                const id = +line[0]
                if (id >= from && (to == undefined || id <= to)) pairs.push({
                    id,
                    pair: line[1],
                    token0: line[2],
                    token1: line[3]
                })
                return pairs
            }, [])
        : []

    if (count) return pairs.length
    if (to && pairs.length > to) return Promise.resolve(pairs.slice(0, to))

    return (to
        ? Promise.resolve(to)
        : client.readContract({
            address: factory,
            abi: [parseAbiItem('function allPairsLength() view returns (uint256)')],
            functionName: 'allPairsLength'
        }).then(_ => Number(_))
    ).then(all_pairs_length => {
        const start_loading_from = pairs.length
            ? Math.max(from || 0, pairs[pairs.length - 1].id + 1)
            : 0

        var next_pair_order = pairs.length
            ? pairs[pairs.length - 1].id + 1
            : 0
        var progress_i = 0
        const progress_end = all_pairs_length - start_loading_from

        missed.forEach(_ => _.length = 0)
        
        const onpair = pair => {
            pairs[pair.id] = pair
            if (progress) progress(++progress_i, progress_end)
            if (filename) {
                var _
                while (_ = pairs[next_pair_order]) {
                    fs.appendFileSync(filename, `${_.id},${_.pair},${_.token0},${_.token1}\n`)
                    next_pair_order++
                }
            }
        }

        if (workers == 0 || multicore == false) {
            const ids = []
            for (var i = start_loading_from; i < all_pairs_length; i++)
                ids.push(i)
            return require('./loader')({ ids, factory, key, multicall_size }, onpair)
        
        }
        for (var i = start_loading_from, rr = 0; i < all_pairs_length; i++) {
            missed[rr].push(i)
            if (missed[rr].length % multicall_size == 0)
                rr = (rr + 1) % workers
        }
        cluster.setupPrimary({ exec: path.join(__dirname, 'loader.js') })
        
        return Promise.all(
            missed
            .filter(_ => _.length)
            .map((ids, i) => new Promise(y => {
                const w = cluster.fork()
                w.send({ ids, factory, key, multicall_size })
                w.on('message', onpair)
                w.on('exit', y)
            }))
        ).then(() => pairs)
    })
}


module.exports.clear_cache = () =>
    fs.unlinkSync(default_filename)

module.exports.all = (params = {}) =>
    load(params)
    
module.exports.count = () =>
    load({count: true})

module.exports.onupdate = function onupdate(callback, params = {}) {
    params.update_timeout ??= 5000
    var subscribe = true, timeout
    load(params)
    .then(pairs => {
        callback(pairs)

        const update = pairs =>
            timeout = setTimeout(
                () =>
                    load({...params, pairs, from: pairs.length})
                    .then(pairs => {
                        if (!subscribe) return
                        callback(pairs)
                        if (!subscribe) return
                        if (params.to && pairs[pairs.length - 1].id >= params.to) return
                        update(pairs)
                    }),
                params.update_timeout
            )

        if (!subscribe) return
        if (params.to && pairs[pairs.length - 1].id >= params.to) return
        update(pairs)
    })

    return () => {
        subscribe = false
        if (timeout) clearTimeout(timeout)
    }
}