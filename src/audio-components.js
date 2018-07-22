const {
  connectAll,
  createNodes,
  setParams,
  paramTimeline,
  num,
  rand
} = require('wakit')

let seq = 0

export class Filter {
  constructor (props, children) {
    this._id = ++seq
    this.type = 'Filter'
    this.node = ac.createBiquadFilter()

    this.children = children
    this.children.forEach(ch => ch.connect(this.node))

    this.update(props)
  }

  get frequency () {
    return this.node.frequency
  }

  set frequency (value) {
    this.node.frequency.value = value
  }

  get gain () {
    return this.node.gain
  }

  set gain (value) {
    this.node.gain.value = value
  }

  get Q () {
    return this.node.Q
  }

  set Q (value) {
    this.node.Q.value = value
  }

  update (props) {
    const params = [
      'frequency',
      'gain',
      'Q'
    ]

    params.forEach(key => {
      if (props[key] === undefined) { return }

      this.updateParam(key, props[key])
    })

    if (props.type) {
      this.node.type = props.type
    }
  }

  updateParam (key, value) {
    (Array.isArray(value) ? value : [value]).forEach(v => {
      if (typeof v === 'number') {
        this[key] = v
      } else if (v.connect) {
        v.connect(this[key])
        this.children.push(v)
      }
    })
  }

  connect (dest) {
    this.node.connect(dest)
  }

  disconnect () {
    this.node.disconnect()
    delete this.node
  }

  start (time) {
    this.children.forEach(ch => ch.start(time))
  }

  stop (time) {
    this.children.forEach(ch => ch.stop(time))
  }
}

export class Osc {
  constructor (props) {
    this._id = ++seq
    this.type = 'Osc'
    this.nodes = createNodes(ac, {
      osc: {
        type: 'Oscillator'
      },
      amp: {
        type: 'Gain'
      }
    })

    this.children = []
    this.update(props)
  }

  get detune () {
    return this.nodes.osc.detune
  }

  set detune (value) {
    this.nodes.osc.detune.value = value
  }

  get frequency () {
    return this.nodes.osc.frequency
  }

  set frequency (value) {
    this.nodes.osc.frequency.value = value
  }

  get gain () {
    return this.nodes.amp.gain
  }

  set gain (value) {
    this.nodes.amp.gain.value = value
  }

  update (props) {
    const params = [
      'detune',
      'frequency',
      'gain'
    ]

    params.forEach(key => {
      if (props[key] === undefined) { return }

      this.updateParam(key, props[key])
    })

    if (props.type) {
      this.nodes.osc.type = props.type
    }
  }

  updateParam (key, value) {
    (Array.isArray(value) ? value : [value]).forEach(v => {
      if (typeof v === 'number') {
        this[key] = v
      } else if (v.connect) {
        v.connect(this[key])

        if (!(v instanceof ConstantSourceNode)) {
          this.children.push(v)
        }
      }
    })
  }

  connect (dest) {
    this.nodes.amp.connect(dest)
  }

  disconnect () {
    if (this.disconnected) {
      return
    }

    this.children.forEach((ch, i) => {
      ch.disconnect()
      delete this.children[i]
    })

    this.nodes.amp.disconnect()
    this.nodes.osc.disconnect()

    delete this.nodes.amp
    delete this.nodes.osc

    this.disconnected = true
  }

  start (time) {
    this.children.forEach(ch => ch.start(time))
    this.nodes.osc.start(time)

    return time
  }

  stop (time) {
    this.children.forEach(ch => {
      ch.stop(time)
    })

    const threshold = 0.002
    const id = setInterval(() => {
      if (this.disconnected) {
        clearInterval(id)
        return
      }

      if (this.gain.value < threshold) {
        this.nodes.osc.stop()
        this.disconnect()
        clearInterval(id)
      }
    }, 500)
  }
}

export class Sample {
  constructor (props) {
    this._id = ++seq
    this.type = 'Sample'

    this.nodes = createNodes(ac, {
      src: {
        type: 'BufferSource'
      },
      amp: {
        type: 'Gain'
      }
    })

    this.children = []
    this.update(props)

    this.nodes.src.buffer = props.buffer
    this.nodes.src.loop = props.loop
    //this.nodes.src.playbackRate.value = props.playbackRate
  }

  get buffer () {
    return this.nodes.src.buffer
  }

  set buffer (value) {
    this.nodes.src.buffer.value = value
  }

  get detune () {
    return this.nodes.src.detune
  }

  set detune (value) {
    this.nodes.src.detune.value = value
  }

  get playbackRate () {
    return this.nodes.src.playbackRate
  }

  set playbackRate (value) {
    this.nodes.src.playbackRate.value = value
  }

  get loop () {
    return this.nodes.src.loop
  }

  set loop (value) {
    this.nodes.src.loop.value = value
  }

  get gain () {
    return this.nodes.amp.gain
  }

  set gain (value) {
    this.nodes.amp.gain.value = value
  }

  update (props) {
    const params = [
      'buffer',
      'detune',
      'playbackRate',
      'loop',
      'gain'
    ]

    params.forEach(key => {
      if (props[key] === undefined) { return }

      this.updateParam(key, props[key])
    })
  }

  updateParam (key, value) {
    (Array.isArray(value) ? value : [value]).forEach(v => {
      if (typeof v === 'number') {
        this[key] = v
      } else if (v.connect) {
        v.connect(this[key])

        if (!(v instanceof ConstantSourceNode)) {
          this.children.push(v)
        }
      }
    })
  }

  connect (dest) {
    this.nodes.amp.connect(dest)
  }

  disconnect () {
    if (this.disconnected) {
      return
    }

    this.children.forEach((ch, i) => {
      ch.disconnect()
      delete this.children[i]
    })

    this.nodes.amp.disconnect()
    this.nodes.src.disconnect()

    delete this.nodes.amp
    delete this.nodes.src

    this.disconnected = true
  }

  start (time) {
    this.children.forEach(ch => ch.start(time))
    this.nodes.src.start(time)

    return time
  }

  stop (time) {
    this.children.forEach(ch => {
      ch.stop(time)
    })

    const threshold = 0.002
    const id = setInterval(() => {
      if (this.disconnected) {
        clearInterval(id)
        return
      }

      if (this.gain.value < threshold) {
        this.nodes.src.stop()
        this.disconnect()
        clearInterval(id)
      }
    }, 500)
  }
}

export class Env {
  constructor (props) {
    this._id = ++seq
    this.type = 'Env'
    this.props = props
    this.param = null
  }

  connect (param) {
    this.param = param
  }

  disconnect () {
    delete this.param
  }

  start (time = ac.currentTime) {
    const { props, param } = this
    if (!param) { return time }

    const { value } = param
    const { attackType = 'linear' } = props

    const finalTime = paramTimeline(param, [
      {
        time,
        value: props.from || 0.0001
      },

      {
        // linearTo or expTo
        [`${attackType}To`]: props.to || value,
        duration: props.attack || 0.1
      }
    ])

    return finalTime
  }
  
  stop (time = ac.currentTime) {
    const { props, param } = this
    if (!param) { return time }

    if (props.release === undefined) { return Infinity }

    const { value } = param
    const { releaseType = 'linear' } = props

    param.cancelScheduledValues(time)
    const finalTime = paramTimeline(param, [
      {
        time,
        value: props.to || value
      },

      {
        [`${releaseType}To`]: props.from || 0.0001,
        duration: props.release || 0.1
      }
    ])

    return finalTime
  }
}
