import {spawn} from 'node:child_process'

async function runNpmScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npm',
      ['run', scriptName],
      {stdio: 'pipe', shell: true},
    )

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Failed to run npm script: ${scriptName}`))
      }
    })

    child.stdout.on('data', (data) => {
      for (const line of data.toString().split(/\r?\n/)) {
        if (line.trim() === '') {
          continue
        }
        console.log(`[${scriptName}] ${line}`)
      }
    })

    child.stderr.on('data', (data) => {
      for (const line of data.toString().split(/\r?\n/)) {
        if (line.trim() === '') {
          continue
        }
        console.error(`[${scriptName}] ${line}`)
      }
    })
  })
}

const scriptNames = process.argv.slice(2)

console.log(`Running npm scripts in parallel: ${scriptNames.join(', ')}`)

const promises = scriptNames.map((scriptName) => runNpmScript(scriptName))

await Promise.all(promises)

console.log('Done')
