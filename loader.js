const { parseAbiItem, createPublicClient, http } = require('viem')
const { mainnet } = require('viem/chains')
const fs = require('fs')

const POOL = {
    ID: 0,
    ADDRESS: 1,
    TOKEN0: 2,
    TOKEN1: 3
}

async function load(client, missed, filename, factory, key) {
    let loaded = 0
    const chunk_size = 50

    for (let i = 0; i < missed.length; i += chunk_size) {
        const chunk = missed.slice(i, i + chunk_size)
        
        try {
            const pool_addresses = await client.multicall({
                contracts: chunk.map(i => ({
                    address: factory,
                    abi: [parseAbiItem('function allPairs(uint256) view returns (address)')],
                    functionName: 'allPairs',
                    args: [BigInt(i)]
                }))
            })

            const pools_ok = []
            const token_calls = []

            pool_addresses.forEach((result, i) => {
                if (result.status == 'success') {
                    const pool_address = result.result
                    pools_ok.push({
                        id: chunk[i],
                        address: pool_address
                    })                    
                    token_calls.push({
                        address: pool_address,
                        abi: [parseAbiItem('function token0() view returns (address)')],
                        functionName: 'token0'
                    })
                    token_calls.push({
                        address: pool_address,
                        abi: [parseAbiItem('function token1() view returns (address)')],
                        functionName: 'token1'
                    })
                } else {
                    console.error('Failed loading pair', chunk[i], result)
                }
            })

            if (token_calls.length === 0) continue

            const token_results = await client.multicall({
                contracts: token_calls
            })

            for (let j = 0, pool = []; j < pools_ok.length; j++) {
                const token0_result = token_results[j * 2]
                const token1_result = token_results[j * 2 + 1]

                if (token0_result.status == 'success' && token1_result.status == 'success') {
                    pool[POOL.ID] = pools_ok[j].id
                    pool[POOL.ADDRESS] = pools_ok[j].address.toLowerCase()
                    pool[POOL.TOKEN0] = token0_result.result.toLowerCase()
                    pool[POOL.TOKEN1] = token1_result.result.toLowerCase()
                    
                    fs.appendFileSync(filename, pool.join(',') + '\n')
                }
            }

        } catch (error) {
            console.error(error.message)
        }
    }
}

const job_index = +process.argv[2]

if (isNaN(job_index)) console.error('Required pass an index of job via argument') || process.exit(1)

const jobs_data = JSON.parse(fs.readFileSync('jobs_data.json', 'utf8'))
const missed = jobs_data.missed[job_index]
const filename = jobs_data.filename
const factory = jobs_data.factory
const key = jobs_data.key

const client = createPublicClient({
    chain: mainnet,
    transport: http(`https://eth-mainnet.g.alchemy.com/v2/${key}`)
})

load(client, missed, filename, factory, key)
