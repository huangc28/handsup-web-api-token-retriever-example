#!/usr/bin/env node

const puppeteer = require('puppeteer')
const fs = require('fs')

function launchBrowser() {
  // emulate the process of handsup login by facebook
  return puppeteer.launch({
    dumpio: true,
    headless: false,
    devtools: true,
    ignoreHTTPSErrors: true,
    product: 'chrome',
    args: ['--disable-notifications']
  })
} 

function * tokenGenFlow () {
  const browser = yield launchBrowser()
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
  const [navResp] = yield Promise.all([
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
  
  // If .env.development.local isn't found in the project directory echo error.
  
  // if .env.development.local is found in the project directory, try replace `VUE_APP_API_TOKEN` with the value of apiToken
  
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
    }
    
    return go(gen.next(node.value))
  }
  
  go(gen.next())
}

goFlow()
