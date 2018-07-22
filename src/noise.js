module.exports = function createNoiseBuffer (ac) {
  try {
    var blen = ac.sampleRate *.5 | 0
    const buf = ac.createBuffer(1, blen, ac.sampleRate)
    var dn = buf.getChannelData(0)
    
    for(var i=0;i<blen;++i){
      dn[i]=Math.random()*2-1;
    }

    return buf
  } catch (e) {
    console.error(e)
  }
}

