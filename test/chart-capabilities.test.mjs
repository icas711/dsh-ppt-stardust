import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probeCharts } from '../scripts/probe-pptx-charts.mjs'

test('SDK native chart capabilities: multiple charts, workbook and cache values, styles and updates', async () => {
  const { report } = await probeCharts()
  assert.equal(report.sdk, '0.21.0')
  assert.equal(report.chartCount, 8)
  assert.equal(report.embeddedWorkbooks, 8)
  assert.deepEqual(report.dataUpdate.after, [18, 4])
})
