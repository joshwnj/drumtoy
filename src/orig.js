import './main.css'

import reverbImpulse from './impulses/Basement.m4a'
import guitarImpulse from './impulses/impulse_guitar.wav'
import defs from './defs'

import { Env, Filter, Osc } from './audio-components'

const dat = require('dat.gui')

if (!window.ac) { window.ac = new AudioContext() }
const { ac } = window

const beatEmitter = require('beat-emitter')
if (!window.beats) { window.beats = beatEmitter(ac) }
const { beats } = window

let bpm = 60
beats.setBpm(bpm)
beats.start()

const {
  connectAll,
  createNodes,
  setParams,
  paramTimeline,
  num,
  rand
} = require('wakit')

const Tuna = require('tunajs')

const tuna = new Tuna(ac)
const master = setParams(ac.createGain(), {
  gain: 1.0
})

const compressor = setParams(ac.createDynamicsCompressor(), {
  threshold: -20,
  knee: 30,
  ratio: 12,
  attack: .1,
  release: .1
})

connectAll(
  master,
  compressor,
  ac.destination
)

// ----

if (window.wasLoaded) {
  location.reload()
}
window.wasLoaded = true

// ----

const scope = require('./osc-scope')
const scopeNode = scope.createNode(ac)
const scopeCanvas = document.querySelector('.scope')

scope.renderLoop(scopeNode, scopeCanvas)
master.connect(scopeNode)

// ----

window.document.addEventListener(
  'keydown',
  onKeyDown,
  false
)

function addNoteToTrack (track) {
  const beat = currentBeat % beatsInBar
  const timeSinceBeat = ac.currentTime - lastBeatTime
  const slice = Math.floor(timeSinceBeat / secsPerSlice)
  const offset = beat * numSlices

  track[offset + slice] = true
}

function onKeyDown (event) {
  switch (event.key) {
  case '1':
  case '2':
  case '3':
  case '4':
    currentTrack = Number(event.key) - 1
    document.querySelector('.track.current').classList.remove('current')
    document.querySelectorAll('.track')[currentTrack].classList.add('current')
    break
    
  case ' ':
    (function () {
      // play immediately
      const fn = defs[currentTrack]
      const props = {
        time: ac.currentTime
      }

      play(fn, props, null, master)

      // also add to the current track
      addNoteToTrack(tracks[currentTrack])
    }())
    break

  case 'Control':
    (function () {
      const fn = defs[currentTrack]
      const props = {
        time: ac.currentTime,
        duration: knobs.duration,
        detune: 0
      }

      play(fn, props, null, master)
    }())
    break

  }
}

const numSlices = 8 
const secsPerBeat = 60.0 / bpm
const secsPerSlice = secsPerBeat / numSlices

let currentTrack = 0
let currentBeat = 0
let lastBeatTime = 0
const beatsInBar = 4
const tracks = window.tracks = [
  [],
  [],
  [],
  []
]

const knobs = {
  volume: 0.5,
  wave: 'sine',
  duration: .4,
  filterFrom: 500,
  attack: 1,
  frequency: 220,
  freqAttack: 10,
  freqDrop: 25,

  threshold: 0,
  knee: 0,
  reduction: 20.0,
  ratio: 10,
  attack: 1.0,
  release: 1.0

}

const gui = new dat.GUI()

gui.remember(knobs)

gui
  .add(knobs, 'volume').min(0.1).max(1.0).step(0.01)
  .onChange(updateDef)

gui
  .add(knobs, 'wave', [ 'sine', 'triangle', 'square' ] )
  .onChange(val => {
    console.log(val)
    updateDef()
  })

gui
  .add(knobs, 'duration').min(.1).max(.5)
  .onChange(updateDef)

gui
  .add(knobs, 'attack').min(1).max(100)
  .onChange(updateDef)

gui
  .add(knobs, 'frequency').min(1).max(440)
  .onChange(updateDef)

gui
  .add(knobs, 'freqAttack').min(1).max(100)
  .onChange(updateDef)

gui
  .add(knobs, 'freqDrop').min(1).max(100)
  .onChange(updateDef)

gui
  .add(knobs, 'threshold')
  .min(compressor.threshold.minValue)
  .max(compressor.threshold.maxValue)
  .onChange((value) => compressor.threshold.value = value)

// initialise
// for (let i = 0; i < tracks.length; i ++) {
//   updateDef(i)
// }

updateDef()

function updateDef () {
  const props = { ...knobs }
  defs[currentTrack] = ({ detune, time }) => {
    const duration = props.duration

    const frequency = props.frequency
    const note = new Filter({
      type: 'lowpass',
      frequency: [
        new Env({
          attack: duration * .5,
          from: props.filterFrom,
          to: 0
        })
      ],
      Q: 1
    }, [
      new Osc({
        type: props.wave,

        detune: detune,

        gain: new Env({
          attack: duration * (props.attack / 100),
          attackType: 'exp',
          from: 0.0001,
          to: props.volume,
          release: duration
        }),

        frequency: [
          new Env({
            attack: duration * (props.freqAttack / 100),
            attackType: 'linear',
            from: frequency,
            to: frequency * (props.freqDrop / 100)
          }),

          new Osc({
            type: 'sine',
            frequency: 5,
            gain: 2
          })
        ]
      })
    ])

    return note
  }
}

// ----


if (window.schedule) {
  beats.clearSchedule(schedule)
}

const tracksEls = document.querySelectorAll('.track')

window.schedule = beats.schedule((beat, time) => {
  lastBeatTime = time
  currentBeat = beat
  const localBeat = beat % beatsInBar


  // highlight the beat
  tracksEls.forEach((el) => {
    el.querySelector('.current').classList.remove('current')
    el.querySelectorAll('.beat')[localBeat].classList.add('current')
  })

  const offset = localBeat * numSlices
  tracks.forEach((track, i) => {
    const fn = defs[i]

    let k
    for (k = 0; k < numSlices; k ++) {
      if (track[k + offset] !== true) { continue }
      
      play(
        fn, 
        { 
          time: time + (k * secsPerSlice)
        },
        null,
        master
      )
    }
  })
})

// ----

const notes = window.notes = {}
let noteSeq = 0

function play (fn, props, detuneSource, dest) {
  const note = connectAll(
    fn(props, detuneSource),
    dest
  )

  const {
    time
  } = props

  const { duration } = knobs

  note.start(time)
  note.stop(time + duration)
  
  const id = ++noteSeq
  notes[id] = note
  setTimeout(() => {
    delete notes[id]
  }, duration * 1000 * 2)
}
