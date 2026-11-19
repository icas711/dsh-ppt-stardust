import test from 'node:test'
import assert from 'node:assert/strict'
import { IDENTITY_TRANSFORM, composeTransforms, transformPoint, transformedBounds, frameTransform, groupTransform } from '../skills/dsh-ppt/scripts/deck-geometry.mjs'

function near(actual, expected) {
  for (const key of Object.keys(expected)) assert.ok(Math.abs(actual[key] - expected[key]) < 1e-8, `${key}: ${actual[key]} != ${expected[key]}`)
}

test('group viewports retain nonzero origins and independent horizontal/vertical scales', () => {
  const parent = groupTransform({ outer: { x:100,y:200,w:400,h:300 }, inner: { x:10,y:20,w:200,h:100 } })
  assert.deepEqual(parent, [2,0,0,3,80,140])
  near(transformPoint({x:10,y:20}, parent), {x:100,y:200})
  near(transformPoint({x:210,y:120}, parent), {x:500,y:500})
  const child = groupTransform({ outer: {x:30,y:40,w:80,h:60}, inner: {x:-10,y:5,w:40,h:20} })
  const composed = composeTransforms(parent, child)
  assert.deepEqual(composed, [4,0,0,9,180,215])
  near(transformedBounds({x:-10,y:5,w:40,h:20}, composed), {x:140,y:260,w:160,h:180})
})

test('clockwise rotation and reflection use the frame centre, in the documented order', () => {
  const frame = {x:10,y:20,w:80,h:40}
  near(transformPoint({x:10,y:20}, frameTransform(frame, {rotation:90})), {x:70,y:0})
  near(transformedBounds(frame, frameTransform(frame, {rotation:90})), {x:30,y:0,w:40,h:80})
  near(transformPoint({x:10,y:20}, frameTransform(frame, {flipH:true})), {x:90,y:20})
  near(transformPoint({x:10,y:20}, frameTransform(frame, {rotation:90,flipH:true})), {x:70,y:80})
  near(transformPoint({x:10,y:20}, frameTransform(frame, {rotation:-270,flipV:true})), {x:30,y:0})
  const group = groupTransform({outer:{x:100,y:200,w:400,h:300},inner:{x:10,y:20,w:200,h:100},rotation:90})
  near(transformPoint({x:10,y:20}, group), {x:450,y:150})
})

test('bounds include all four corners for affine transforms and keep negative coordinates', () => {
  near(transformedBounds({x:-10,y:-20,w:40,h:30}, [1,.5,.25,1,-100,20]), {x:-115,y:-5,w:47.5,h:50})
  const composed = composeTransforms([2,0,0,3,80,140], [0,1,-1,0,100,0])
  near(transformedBounds({x:10,y:20,w:40,h:10}, composed), {x:220,y:170,w:20,h:120})
  assert.deepEqual(transformedBounds({x:-20,y:-10,w:0,h:10}), {x:-20,y:-10,w:0,h:10})
  const input = Object.freeze({x:-1,y:2,w:3,h:4})
  assert.deepEqual(transformedBounds(input), input)
  assert.deepEqual(IDENTITY_TRANSFORM, [1,0,0,1,0,0])
})

test('geometry rejects invalid matrices, dimensions and overflow instead of emitting NaN', () => {
  for (const value of [[], [1,0,0,1,0], [1,0,0,1,0,Infinity], ['1',0,0,1,0,0]]) assert.throws(() => transformPoint({x:0,y:0}, value), /Invalid geometry/)
  assert.throws(() => transformedBounds({x:0,y:0,w:-1,h:1}), /dimensions/)
  assert.throws(() => groupTransform({outer:{x:0,y:0,w:1,h:1},inner:{x:0,y:0,w:0,h:1}}), /positive/)
  assert.throws(() => frameTransform({x:0,y:0,w:1,h:1}, {flipH:1}), /boolean/)
  assert.throws(() => frameTransform({x:0,y:0,w:1,h:1}, {rotation:NaN}), /finite/)
  assert.throws(() => transformPoint({x:Number.MAX_VALUE,y:1}, [2,0,0,1,0,0]), /finite/)
  assert.throws(() => composeTransforms([Number.MAX_VALUE,0,0,1,0,0], [2,0,0,1,0,0]), /finite/)
})
