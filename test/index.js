const fs = require('fs')
const path = require('path')
const test = require('tape')

const badge = require('../index')

function clean (string) {
  return string.replace(/ /g, '').replace(/\n/g, '')
}

test('badgeit', (t) => {
  t.plan(5)

  t.test('should work with nothing passed in', async (t) => {
    t.plan(1)

    try {
      t.equal(clean(await badge()), clean(fs.readFileSync(path.resolve(__dirname, 'fixtures', 'basic.svg')).toString('utf8')))
    } catch (ex) {
      t.fail(ex)
    }
  })

  t.test('should work with overrides (text)', async (t) => {
    t.plan(1)

    try {
      t.equal(clean(await badge({ text: ['hello world', '100%'] })), clean(fs.readFileSync(path.resolve(__dirname, 'fixtures', 'override_text.svg')).toString('utf8')))
    } catch (ex) {
      t.fail(ex)
    }
  })

  t.test('should work with overrides (colors)', async (t) => {
    t.plan(1)

    try {
      t.equal(clean(await badge({ text: ['coverage', '100%'], colors: { left: '#eb46ff', right: '#cff2c2', font: '#ffffff' } })), clean(fs.readFileSync(path.resolve(__dirname, 'fixtures', 'override_color.svg')).toString('utf8')))
    } catch (ex) {
      t.fail(ex)
    }
  })

  t.test('should throw if font path doesn\'t exist', async (t) => {
    t.plan(2)

    try {
      await badge({ fontPath: '/nowhere/land' })
      t.fail('should have thrown error')
    } catch (ex) {
      t.ok(ex instanceof Error)
      t.equal(ex.message, 'font could not be loaded')
    }
  })

  t.test('should throw if text doesn\'t contain two string elements', async (t) => {
    t.plan(2)

    try {
      await badge({ text: ['coverage'] })
      t.fail('should have thrown error')
    } catch (ex) {
      t.ok(ex instanceof Error)
      t.equal(ex.message, 'text should contain an array of two string elements')
    }
  })
})
