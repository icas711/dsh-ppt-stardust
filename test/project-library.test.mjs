import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const items = [
  { id: 'a', owner: 'alice', title: 'First', updatedAt: '2026-01-01' },
  { id: 'b', owner: 'bob', title: 'Second', updatedAt: '2026-01-02' },
  { id: 'c', owner: 'alice', title: 'Third', updatedAt: '2026-01-03' },
  { id: 'd', title: 'Legacy', updatedAt: '2026-01-04' },
]
function render(groupByOwner, query = '') {
  const source = readFileSync(new URL('../templates/panels/library.js', import.meta.url), 'utf8')
  let state = 0
  const context = {
    React: { useState: initial => [state++ === 0 ? query : initial, () => {}], useId: () => 'library' },
    h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
    W: { Empty: 'empty', Button: 'button' }, tplTr: (_ru, en) => en,
  }
  const component = runInNewContext(source + '\nProjectLibrary', context)
  return component({ items, groupByOwner, language: 'en', t: (_zh, en) => en,
    searchText: row => row.title + ' ' + (row.owner || ''), updatedAt: row => row.updatedAt,
    renderItem: row => ({ type: 'row', props: { id: row.id }, children: [] }) })
}
function nodes(tree, type) {
  return [tree, ...(tree.children || []).flatMap(child => child && typeof child === 'object' ? nodes(child, type) : [])].filter(node => node.type === type)
}

test('admin project library renders collapsed owner groups with projects nested underneath', () => {
  const tree = render(true)
  const groups = nodes(tree, 'details')
  assert.equal(groups.length, 3)
  const alice = groups.find(group => nodes(group, 'summary')[0].children[0] === 'alice')
  assert.deepEqual(Array.from(nodes(alice, 'row'), row => row.props.id), ['c', 'a'])
  assert.ok(groups.every(group => !group.props.open))
  assert.ok(groups.some(group => nodes(group, 'summary')[0].children[0] === 'No owner'))
  assert.equal(nodes(render(false), 'details').length, 0)
  assert.equal(nodes(render(false), 'row').length, items.length)
})

test('search filters owner groups and keeps the sorted projects within the matching group', () => {
  const tree = render(true, 'alice')
  assert.equal(nodes(tree, 'details').length, 1)
  assert.deepEqual(Array.from(nodes(tree, 'row'), row => row.props.id), ['c', 'a'])
  assert.equal(nodes(render(true, 'missing'), 'empty').length, 1)
})
