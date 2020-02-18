const fs = require('fs')
 
const readDotEnvFile = path => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err)
      resolve(data)
    }) 
  })
}

const writeToDotEnvFile = (path, content) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, 'utf8', (err) => {
      if (err) reject(data)
      resolve()
    })
  })
}

const appendToDotEnvFile = (path, content) => {
  return new Promise((resolve, reject) => {
    fs.appendFile(path, content, err => {
      if (err) reject(err)
      resolve() 
    })
  })
}

module.exports = {
  readDotEnvFile,
  writeToDotEnvFile,
  appendToDotEnvFile
}
