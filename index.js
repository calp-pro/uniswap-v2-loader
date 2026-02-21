const { spawn } = require('child_process')
const os = require('os')
const fs = require('fs')
const { parseAbiItem, createPublicClient, http } = require('viem')
const { mainnet } = require('viem/chains')
const workers = os.cpus().length - 1
const missed = Array(workers).fill(null).map(() => [])
const key = process.env.KEY || 'FZBvlPrOxtgaKBBkry3SH0W1IqH4Y5tu'
const factory = '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f'
const client = createPublicClient({
    chain: mainnet,
    transport: http('https://eth-mainnet.g.alchemy.com/v2/' + key)
})

const load = params => {
    const {filename, to} = params
    const pairs_ids = filename && fs.existsSync(filename)
        ? fs.readFileSync(filename).toString().trim().split('\n')
            .map(line => +line.split(',')[0])
        : []

    return (to
        ? Promise.resolve(to)
        : client.readContract({
            address: factory,
            abi: [parseAbiItem('function allPairsLength() view returns (uint256)')],
            functionName: 'allPairsLength'
        }).then(_ => Number(_))
    ).then(allPairsLength => {
        const pairs = Array(allPairsLength)
        var next_pair_order = 0    
        var start_from = pairs_ids.length
            ? pairs_ids[pairs_ids - 1] + 1
            : 0

        missed.forEach(_ => _.length = 0)
        
        for (var i = start_from, rr = 0; i < allPairsLength; i++) {
            missed[rr].push(i)
            rr = (rr + 1) % workers
        }
                
        const jobs_data_filename = `jobs_data_${Date.now()}.json`
        fs.writeFileSync(jobs_data_filename, JSON.stringify({
            missed,
            factory,
            key
        }), 'utf8')
        
        return Promise.all(
            missed
            .filter(_ => _.length)
            .map((_, i) => new Promise(y => {
                const loader = spawn('node', ['loader.js', jobs_data_filename, i.toString()])
                loader.stdout.on('data', line => {
                    line = line.toString()
                    const data = line.trim().split(',')
                    const id = data[0]
                    pairs[id] = {
                        id,
                        pair: data[1],
                        token0: data[2],
                        token1: data[3]
                    }
                    if (filename) {
                        var pair
                        while (pair = pairs[next_pair_order]) {
                            fs.appendFileSync(filename, pair.id + ',' + pair.pair + ',' + pair.token0 + ',' + pair.token1 + '\n')
                            next_pair_order++
                        }
                    }
                })
                loader.on('close', y)
            }))
        )
        .then(() => {
            fs.unlinkSync(jobs_data_filename)
            return pairs
        })
    })
}


module.exports.all = params =>
    load(params)
