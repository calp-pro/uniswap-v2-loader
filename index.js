const { spawn } = require('child_process')
const os = require('os')
const fs = require('fs')
const { parseAbiItem, createPublicClient, http } = require('viem')
const { mainnet } = require('viem/chains')
const workers = os.cpus().length - 1
const missed = Array(workers).fill(null).map(() => [])
const key = process.env.KEY || process.argv[2] || 'FZBvlPrOxtgaKBBkry3SH0W1IqH4Y5tu'
const factory = '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f'
const client = createPublicClient({
    chain: mainnet,
    transport: http('https://eth-mainnet.g.alchemy.com/v2/' + key)
})

const all = () => {
    const filename = 'pairs.csv'
    const pairs_ids = fs.existsSync(filename)
        ? fs.readFileSync(filename).toString().trim().split('\n')
            .map(line => +line.split(',')[0])
        : []

    return client.readContract({
        address: factory,
        abi: [parseAbiItem('function allPairsLength() view returns (uint256)')],
        functionName: 'allPairsLength'
    }).then(allPairsLength => {
        allPairsLength = Number(allPairsLength)
        
        missed.forEach(_ => _.length = 0)
        
        for (var i = 0, rr = 0; i < allPairsLength; i++) {
            if (pairs_ids.includes(i)) continue
            missed[rr].push(i)
            rr = (rr + 1) % workers
        }
        
        const jobs_data = {
            missed,
            factory,
            filename,
            key
        }
        
        fs.writeFileSync('jobs_data.json', JSON.stringify(jobs_data), 'utf8')
        
        return Promise.all(
            jobs_data.missed
            .filter(_ => _.length)
            .map((_, i) => new Promise(y =>
                spawn('node', ['loader.js', i.toString()])
                .on('close', y)
            ))
        )
        .then(() =>
            fs.readFileSync(filename).toString().trim().split('\n')
            .map(line => {
                line = line.split(',')
                return {
                    id: +line[0],
                    pair: line[1],
                    token0: line[2],
                    token1: line[3]
                }
            })
        )
    })
}
    
module.exports.all = all