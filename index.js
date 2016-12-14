const collect = require('collect-stream')
const Readable = require('stream').Readable

module.exports = {read, readlink, link, resolve}

function readlink (archive, entry, cb) {
  collect(archive.createFileReadStream(entry), (err, body) => {
    if (err) return cb(err, null)
    var l
    try {
      l = decode(body)
    } catch (e) {
      return cb(new Error('not a link'), null)
    }
    if (!l) return cb(new Error('not a link'), null)
    cb(null, l)
  })
}

function read (drive, archive, entry, cb) {
  readlink(archive, entry, (err, key) => {
    if (err) return cb(err)
    cb(null, drive.createArchive(key))
  })
}

function link (archive, entry, destArchiveKey, cb) {
  var s = new Readable()
  s.push(encode(destArchiveKey))
  s.push(null)
  var w = archive.createFileWriteStream(entry)
  s.pipe(w).on('finish', cb)
}

function resolve (archive, path, cb) {
  var components = path.split('/')
  var partialPath = []
  var found = false
  archive.list((err, entries) => {
    if (err) return cb(err)
    for (var i = 0; i < components.length; i++) {
      var c = components[i]
      partialPath.push(c)

      if (exist(entries, partialPath)) {
        readlink(archive, partialPath.join('/'), (err, link) => {
          if (err && err.message === 'not a link') {
            return cb(new Error(`unresolvable at ${partialPath.join('/')}`))
          }
          if (err) return cb(err)

          return cb(null, link, components.slice(i + 1).join('/'))
        })
        found = true
        break
      }
    }

    if (!found) {
      cb(new Error(`unresolvable path ${path}`))
    }
  })

  function exist (entries, partialPath) {
    if (entries.find(x => x.name === partialPath.join('/'))) return true

    return false
  }
}

function encode (destKey) {
  if (destKey instanceof Buffer) return JSON.stringify({l: destKey.toString('hex')})
  return JSON.stringify({l: destKey})
}

function decode (b) {
  return JSON.parse(b).l
}
