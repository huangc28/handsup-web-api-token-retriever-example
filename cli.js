#!/usr/bin/env node

// A command line tool to refresh `api_token` for requesting handsup api.
// It uses `puppeteer` to automate handup facebook login procedure to retrieve.
// new api token. The newly retrieved `api_token` will replace the one found in 
// via matching	`VUE_APP_API_TOKEN` in`.env.development.local`. If not match found
// in `.env.development.local`, it simply append a api key on the rear on the file.
// 
// Usage: 
// 
//    gen_token <fb_username> <fb_password>
//    gen_token <fb_username> <fb_password> [-e] [alpha | stg | prod]
//    gen_token -h | --help
//
// Options:
// 
//   -h --help  Show this screen.
//   -e         Specify handsup environment where the API token is retrieved from.

const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

const { 
  readDotEnvFile, 
  writeToDotEnvFile,
  appendToDotEnvFile
} = require('./helpers/fs')

function * tokenGenFlow (username, password, envOrigin, dotEnvFilePath) {
  try {
    const browser = yield puppeteer.launch({
      dumpio: true,
      headless: false,
      devtools: true,
      ignoreHTTPSErrors: true,
      product: 'chrome',
      args: ['--disable-notifications']
    })
    const newPage = yield browser.newPage()
    yield newPage.goto(envOrigin, {
      timeout: 0
    })
    
    yield newPage.waitForSelector('#loginform', {
      visible: true,
      timeout: 0,
    })
    
    // Prompt facebook email and password
    yield newPage.focus('#email')
    yield newPage.keyboard.type(username)
    yield newPage.focus('#pass')
    yield newPage.keyboard.type(password)

    
    // Clicked on the facebook logged in button, wait to navigation to be done
    yield Promise.all([
      newPage.waitForNavigation(), 
      newPage.click('button#loginbutton')  
    ])
    
    const grantButtonSelectorPath = 'div._6-v1 > div:nth-child(2) > div' 
    yield newPage.waitForSelector(grantButtonSelectorPath)    
    yield newPage.evaluate(path => {
      const grantButton = document.querySelector(path)
      grantButton.click()
    }, grantButtonSelectorPath)
    
    yield newPage.waitFor(3 * 1000)

    const cookies = yield newPage.cookies()  
    
    // Retrieve `api_token` from cookie.
    const apiToken = cookies.find(cookie => cookie.name === 'api_token')
    
    // @TODO find a way to not reading all file content into memory before writing. 
    //       It fails if we are reading large glob.
    const content = yield readDotEnvFile(dotEnvFilePath)
    const reg = new RegExp('^VUE_APP_API_TOKEN=.+$', 'gm')
    
    // if .env.development.local is found in the project directory, try replace `VUE_APP_API_TOKEN` with the value of apiToken
    if (reg.test(content)) {
      yield writeToDotEnvFile(
        dotEnvFilePath,  
        content.replace(reg, `VUE_APP_API_TOKEN=${apiToken.value}\n`)
      ) 
    } else {
      yield appendToDotEnvFile(
        dotEnvFilePath,  
        `VUE_APP_API_TOKEN=${apiToken.value}\n`
      ) 
    }
    
    yield newPage.close()
    yield browser.close()
    
    console.log(
      chalk.green('API token has renewed!')
      
    )
  } catch (err) {
    throw err
  }
}

function goFlow (username, password, envOrigin, dotEnvFilePath) {
  const gen = tokenGenFlow(username, password, envOrigin, dotEnvFilePath)
  const go = node => {
    if (node.done) return
    
    // Check if value is a Promise. If it is a promise we proceed the
    // flow in `Promise.then` fashion.
    if (node.value.then && node.value.then instanceof Function) {
      return node
        .value
        .then(res => go(gen.next(res)))
        .catch(err => gen.throw(err))
    }
    
    return go(gen.next(node.value))
  }
  
  go(gen.next())
    .catch(err => {
      console.error(
        chalk.error(
          'Error occurrd: \n\n' +
          err.message
        )
      )
    })
}

function displayDocument () {
  console.log(
    'Usage: \n\n' + 
    '  gen_token <fb_username> <fb_password> \n' + 
    '  gen_token <fb_username> <fb_password> [-e] [alpha | stg | prod] \n' +
    '  gen_token -h | --help \n\n' +
    'Options: \n\n' + 
    '  -h --help  Show command document\n' + 
    '  -e         Specify handsup environment where the API token is retrieved from\n'
  )
}

const availableOptions = [
  '-h',
  '--help',
  '-e'
]

const args = process.argv.slice(2)
const positioned = args.slice(0, 3)
const options = args.slice(3)
const displayDoc = args.some(option => option === '--help' || option === '-h' )

if (displayDoc) {
  displayDocument()

  process.exit(1)
}

// Try to find .env.development.local from the project directory  
// In the package dev mode, we will have `.env.development.local`
// in the package root directory. If it is installed by other
// project, `.env.development.local` would be at that project
// directory.
const dotEnvFilePath = path.resolve(process.cwd(), '.env.development.local')
const localEnvExists = fs.existsSync(dotEnvFilePath)
if (!localEnvExists) {
  console.log(
    chalk.red(
      ' .env.development.local does not exists,' + 
      ' please create .env.deveopment.local in the' + 
      ' project directory before proceed'
    )
  )
  
  process.exit(1)
}

const credentials = positioned
  .reduce((accu, pos, index, source) => {
    if (source[index-1] === '-e') {
      return accu
    }
    
    if (availableOptions.includes(pos)) {
      return accu
    }
    
    return accu.concat(pos)
  }, [])

if (credentials.length < 2) {
  console.log(
    chalk.red(
      ' Please enter facebook username and password' + 
      ' to generate handsup API token.\n\n'
    ),
    'gen_token --help \n\n' +
    chalk.yellow(
      'Note: next version of this tool will generate a new ' + 
      'facebook account for you'
    )
  )
  
  process.exit(1)
}

// Retrieve -e option and it's value 
const ALPHA_ENDPOINT = 'https://admin-alpha.handsup.dev'  
const STG_ENDPOINT = 'https://admin-master.handsup.dev'
const PROD_ENDPOINT = 'https://admin.handsup.shop'

const ALPHA_PLACE_HOLDER = 'alpha'
const STG_PLACE_HOLDER = 'stg'
const PROD_PLACE_HOLDER = 'prod'

const PLACE_HOLDER_MAP = {
  [ALPHA_PLACE_HOLDER]: ALPHA_ENDPOINT,
  [STG_PLACE_HOLDER]: STG_ENDPOINT,
  [PROD_PLACE_HOLDER]: PROD_ENDPOINT 
}

const envIdx = options.indexOf('-e')
let envOrigin = PLACE_HOLDER_MAP[options[envIdx + 1]]

if (!envOrigin) {
  console.log(
    chalk.green(
      'No environment specified, use: \n\n' + 
      `${STG_ENDPOINT}\n\n` +
      'as the default environment'
    )
  )
  
  envOrigin = STG_ENDPOINT  
}

const [username , password] = credentials

goFlow(username, password, envOrigin, dotEnvFilePath)

