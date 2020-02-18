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
//    gen_token -h | --help
//
// Options:
// 
//   -h --help  Show this screen

const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const { 
  readDotEnvFile, 
  writeToDotEnvFile,
  appendToDotEnvFile
} = require('./helpers/fs')

function * tokenGenFlow () {
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
    yield newPage.goto('https://admin-master.handsup.dev', {
      timeout: 0
    })
    
    yield newPage.waitForSelector('#loginform', {
      visible: true,
      timeout: 0,
    })
    
    // Prompt facebook email and password
    yield newPage.focus('#email')
    yield newPage.keyboard.type('belle.hsu2333@gmail.com')
    yield newPage.focus('#pass')
    yield newPage.keyboard.type('2333@handsup')

    
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
    
    // Try to find .env.development.local from the project directory  
    // In the package dev mode, we will have `.env.development.local`
    // in the package root directory. If it is installed by other
    // project, `.env.development.local` would be at that project
    // directory.
    // @TODO the check should be moved to guard clause.
    // @TODO find a way to not reading all file content into memory before writing. 
    //       It fails if we are reading large glob.
    const dotEnvFilePath = path.resolve(process.cwd(), '.env.development.local')
    const localEnvExists = fs.existsSync(dotEnvFilePath)
    // If .env.development.local isn't found in the project directory echo error.
    if (!localEnvExists) {
      throw new Error('.env.development.local does not exists, please create .env.deveopment.local before proceed')  
    }
    
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
    
  } catch (err) {
    throw err
  }
}

function goFlow () {
  const gen = tokenGenFlow()
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
    .catch(err => console.error('outside the flow', err))
}

// Retrieve arguments via process

goFlow()
