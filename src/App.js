import React, { Component } from 'react'

import './main.css'

import defs from './defs'

import { Env, Filter, Osc, Sample } from './audio-components'

const dat = require('dat.gui')

if (!window.ac) { window.ac = new AudioContext() }
const { ac } = window
 
var blen = ac.sampleRate *.5 | 0
const buffer = ac.createBuffer(1, blen, ac.sampleRate)
var dn = buffer.getChannelData(0)

for(var i=0;i<blen;++i){
  dn[i]=Math.random()*2-1;
}

const beatEmitter = require('beat-emitter')
if (!window.beats) { window.beats = beatEmitter(ac) }
const { beats } = window

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

const scope = require('./osc-scope')
const scopeNode = scope.createNode(ac)
const scopeCanvas = document.querySelector('.scope')

scope.renderLoop(scopeNode, scopeCanvas)
master.connect(scopeNode)

// ----

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

// ----

const notes = window.notes = {}
let noteSeq = 0

function play (fn, props, detuneSource, dest) {
  const note = connectAll(
    fn(props, detuneSource),
    dest
  )

  const {
    time,
    duration
  } = props

  note.start(time)
  note.stop(time + duration)
  
  const id = ++noteSeq
  notes[id] = note
  setTimeout(() => {
    delete notes[id]
  }, duration * 1000 * 2)
}

function updateDef (currentTrack, props) {
  defs[currentTrack] = ({ detune, time }) => {
    const duration = props.duration

    const frequency = props.frequency

    const src = props.wave === 'noise' ? new Filter({
      type: 'highpass',
      frequency: [
        new Env({
          attack: duration * (props.freqAttack / 100),
          attackType: 'linear',
          from: frequency * 100,
          to: 2000 * (props.freqDrop / 100)
        })            
      ],
      gain: 10,
    }, [
      new Sample({
        buffer,
        loop: true,
        playbackRate: 1,
        gain: new Env({
          attack: duration * (props.attack / 100),
          attackType: 'exp',
          from: 0.0001,
          to: props.volume,
          release: duration
        })
      })
    ]) : new Osc({
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
      src
    ])

    return note
  }
}

// ----

export default class App extends Component {
  state = {
    bpm: 60,
    beatsInBar: 4,
    numSlices: 8,
    currentTrack: 0,
    currentBeat: 0,
    tracks: [
      [],
      [],
      [],
      []
    ]
  }

  lastBeatTime = 0

  trackKnobs = []

  componentWillMount () {
    const { bpm } = this.state

    beats.setBpm(bpm)
    beats.start()

    this.schedule = beats.schedule((beat, time) => {
      const {
        bpm,
        beatsInBar,
        tracks,
        numSlices
      } = this.state

      const secsPerBeat = 60.0 / bpm
      const secsPerSlice = secsPerBeat / numSlices

      this.lastBeatTime = time
      this.setState({
        currentBeat: beat
      })
      
      const localBeat = beat % beatsInBar
      const offset = localBeat * numSlices
      tracks.forEach((track, i) => {
        const fn = defs[i]

        let k
        for (k = 0; k < numSlices; k ++) {
          if (track[k + offset] !== true) { continue }
          
          play(
            fn, 
            { 
              time: time + (k * secsPerSlice),
              duration: this.trackKnobs[i].duration
            },
            null,
            master
          )
        }
      })
    })

    window.document.addEventListener(
      'keydown',
      this.onKeyDown,
      false
    )

    const { currentTrack } = this.state
    this.setupTrackKnobs()
    const gui = this.gui = new dat.GUI()

    this.knobs = {
      ...this.trackKnobs[currentTrack]
    }
    const knobs = this.knobs
    gui.remember(knobs)

    gui
      .add(knobs, 'volume').min(0.1).max(1.0).step(0.01)
      .onChange(this.updateDef)

    gui
      .add(knobs, 'wave', [ 'sine', 'triangle', 'square', 'noise' ] )
      .onChange(this.updateDef)

    gui
      .add(knobs, 'duration').min(.1).max(.5)
      .onChange(this.updateDef)

    gui
      .add(knobs, 'attack').min(1).max(100)
      .onChange(this.updateDef)

    gui
      .add(knobs, 'frequency').min(1).max(440)
      .onChange(this.updateDef)

    gui
      .add(knobs, 'freqAttack').min(1).max(100)
      .onChange(this.updateDef)

    gui
      .add(knobs, 'freqDrop').min(1).max(100)
      .onChange(this.updateDef)
  }

  componentWillUnmount () {
    window.document.removeEventListener(
      'keydown',
      this.onKeyDown,
      false
    )

    beats.clearSchedule(this.schedule)

    this.gui.destroy()
  }

  componentDidUpdate (prevProps, prevState) {
    const { currentTrack } = this.state

    if (prevState.currentTrack !== currentTrack) {
      const values = this.trackKnobs[currentTrack]

      this.gui.__controllers.forEach(c => {
        c.setValue(values[c.property])
      })
    }
  }

  updateDef = () => {
    const { currentTrack } = this.state
    const props = { ...this.knobs }

    this.trackKnobs[currentTrack] = props

    updateDef(currentTrack, props)
  }

  setupTrackKnobs () {
    //const { tracks } = this.state
    // Array(tracks.length).fill(0).forEach((_, i) => {
    //   this.trackKnobs[i] = {
    //     volume: 0.5,
    //     wave: 'sine',
    //     duration: .4,
    //     filterFrom: 500,
    //     attack: 1,
    //     frequency: 220,
    //     freqAttack: 10,
    //     freqDrop: 25
    //   }
    // })
    
    this.trackKnobs = [{"volume":0.5,"wave":"sine","duration":0.4,"filterFrom":500,"attack":1,"frequency":220,"freqAttack":10,"freqDrop":25},{"volume":0.41000000000000003,"wave":"triangle","duration":0.10785774767146486,"filterFrom":500,"attack":1,"frequency":437.8440304826418,"freqAttack":14.747671464860288,"freqDrop":25.477561388653683},{"volume":0.42,"wave":"noise","duration":0.4,"filterFrom":500,"attack":5.090770533446232,"frequency":47.6878916172735,"freqAttack":7.2367485182049105,"freqDrop":11.528704487722269},{"volume":0.5,"wave":"noise","duration":0.1,"filterFrom":500,"attack":1,"frequency":28.65588484335309,"freqAttack":1.8718035563082134,"freqDrop":100}]

    this.trackKnobs.forEach((props, i) => {
      updateDef(i, props)
    })
  }

  onKeyDown = (event) => {
    const {
      currentTrack
    } = this.state

    const self = this

    switch (event.key) {
    case '1':
    case '2':
    case '3':
    case '4':
      (function () {
        const currentTrack = Number(event.key) - 1
        self.setState({
          currentTrack
        })
      }())
      break
      
    case 'a':
    case 's':
    case 'd':
    case 'f':
    case ' ':
      (function () {
        // play immediately
        const keys = ['a', 's', 'd', 'f']
        const trackIndex = event.key === ' ' ? 
              currentTrack :
              keys.indexOf(event.key)
        const fn = defs[trackIndex]
        const props = {
          time: ac.currentTime,
          duration: self.trackKnobs[trackIndex].duration
        }

        play(fn, props, null, master)

        // control: record
        if (event.ctrlKey) {
          self.addNoteToTrack(trackIndex)
        }
      }())
      break

    case 'p':
      console.log(JSON.stringify(this.trackKnobs))
      break
    }
  }

  addNoteToTrack (trackIndex = this.state.currentTrack) {
    const { 
      bpm,
      beatsInBar,
      currentBeat,
      numSlices
    } = this.state

    const secsPerBeat = 60.0 / bpm
    const secsPerSlice = secsPerBeat / numSlices

    const localBeat = currentBeat % beatsInBar
    const timeSinceBeat = ac.currentTime - this.lastBeatTime
    const slice = Math.floor(timeSinceBeat / secsPerSlice)
    const offset = localBeat * numSlices

    this.toggleSlice(trackIndex, offset + slice)
  }

  toggleSlice (trackIndex, sliceIndex) {
    const { tracks } = this.state
    // make a copy
    const track = tracks[trackIndex].slice()
    track[sliceIndex] = !Boolean(track[sliceIndex])

    const newTracks = tracks.slice()
    newTracks[trackIndex] = track
    
    this.setState({
      tracks: newTracks
    })
  }

  render () {
    const { 
      tracks,
      beatsInBar,
      currentTrack,
      currentBeat,
      numSlices
    } = this.state

    const localBeat = currentBeat % beatsInBar

    return (
      <div>
        <div className='tracks'>
          {tracks.map((track, trackIndex) => (
            <div key={`track-${trackIndex}`} className={`track ${currentTrack === trackIndex ? 'current' : ''}`}>
              {Array(beatsInBar).fill(0).map((_, i) => {
                const offset = i * numSlices
                return (
                  <div key={`beat-${i}`} className={`beat ${localBeat === i ? 'current' : ''}`}>
                    {Array(numSlices).fill(0).map((_, i) => (
                      <span key={`slice-${i}`} className={`slice ${track[offset + i] === true ? 'hasNote' : ''}`} onClick={() => {
                        this.toggleSlice(trackIndex, offset + i)
                      }} />
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }
}
