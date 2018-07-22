import { Env, Osc, Sample, Filter } from './audio-components'

const {
  connectAll,
  createNodes,
  setParams,
  paramTimeline,
  num,
  rand
} = require('wakit')

const noteToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12)
const freqToNote = require('frequency-to-midi-note-number')

if (!window.ac) { window.ac = new AudioContext() }
const { ac } = window

const oscTypes = [
  'sine',
  'triangle',
  'sawtooth'
]

const note = ({ detune, time, duration }) => {
  const frequency = 220

  const note = new Filter({
    type: 'lowpass',
    frequency: [
      new Env({
        attack: duration * .1,
        from: 500,
        to: 0
      })
    ],
    Q: 1
  }, [
    new Osc({
      type: 'sine',

      detune: detune,

      gain: new Env({
        attack: duration * .01,
        attackType: 'exp',
        from: 0.0001,
        to: 1.0,
        release: duration
      }),

      frequency: [
        new Env({
          attack: duration * .1,
          attackType: 'linear',
          from: frequency,
          to: frequency * .25
        })
      ]
    })
  ])

  return note
}

const defs = [
  note,
  note,
  note,
  note
]

export default defs
