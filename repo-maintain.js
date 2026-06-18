const { search } = require('./script/search')
const { filter } = require('./script/filter')
const { runChecks } = require('./script/runChecks')
const { createReport } = require('./script/createReport')
const { createHTML } = require('./script/createHTML')
const Fs = require('fs')

const CACHE_DIR = '.cache'
const SEARCH_CACHE = `${CACHE_DIR}/search-results.json`
const CHECKS_CACHE = `${CACHE_DIR}/check-results.json`

repoMaintain()

async function repoMaintain() {
  const startTime = Date.now()

  if (2 < process.argv.length && 'silent' == process.argv[2]) {
    console.log = function () {}
  }

  if (!Fs.existsSync(CACHE_DIR)) {
    Fs.mkdirSync(CACHE_DIR)
  }

  const githubToken = process.env.GITHUB_TOKEN || null
  const useCache = process.env.USE_CACHE === 'true'

  let searchResults
  if (useCache && Fs.existsSync(SEARCH_CACHE)) {
    console.log('Loading search results from cache...')
    searchResults = JSON.parse(Fs.readFileSync(SEARCH_CACHE, 'utf8'))
    console.log(`Loaded ${searchResults.length} repos from cache.\n`)
  } else {
    searchResults = await search(githubToken)
    Fs.writeFileSync(SEARCH_CACHE, JSON.stringify(searchResults))
    console.log('Search results saved to cache.\n')
  }

  // Inject fork overrides for preview (feature/fork-preview branch only)
  const FORK_OVERRIDES_FILE = 'fork-overrides.json'
  if (Fs.existsSync(FORK_OVERRIDES_FILE)) {
    const overrides = JSON.parse(Fs.readFileSync(FORK_OVERRIDES_FILE, 'utf8'))
    const existingNames = new Set(searchResults.map(r => r.full_name))
    const newForks = overrides.filter(r => !existingNames.has(r.full_name))
    if (newForks.length > 0) {
      console.log(`Injecting ${newForks.length} fork overrides from ${FORK_OVERRIDES_FILE}...\n`)
      searchResults = [...searchResults, ...newForks]
    }
  }

  let Plugins = await filter(searchResults)

  let checkResults
  if (useCache && Fs.existsSync(CHECKS_CACHE)) {
    console.log('Loading check results from cache...')
    checkResults = JSON.parse(Fs.readFileSync(CHECKS_CACHE, 'utf8'))
    console.log(`Loaded ${Object.keys(checkResults).length} plugins from cache.\n`)
  } else {
    checkResults = await runChecks(Plugins)
    Fs.writeFileSync(CHECKS_CACHE, JSON.stringify(checkResults))
    console.log('Check results saved to cache.\n')
  }

  await createReport(checkResults)
  await createHTML(checkResults)

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.info(
    `Process complete. See REPORT files for details - available in Markdown and CSV formats.\nTotal time: ${elapsed} minutes`
  )
}
