const libraryCode = `

const add = v => (e, i) => e + v[i];

Float32Array.prototype.add = function(v) {
  return this.map(add(v));
};

const sub = v => (e, i) => e - v[i];

Float32Array.prototype.sub = function(v) {
  return this.map(sub(v));
};

const mult = s => e => e * s;

Float32Array.prototype.mult = function(s) {
  return this.map(mult(s));
};

const div = s => e => e / s;

Float32Array.prototype.div = function(s) {
  return this.map(div(s));
};

const delay = m => (e, i, x) => x[(i + m) % numSamples];

Float32Array.prototype.delay = function(m) {
  return this.map(delay(m));
};

const clip = (g = 0.3) => e => {
  let max = Math.abs(g);
  let min = -max;
  if (e > max) {
    return max;
  }
  else if (e < min) {
    return min;
  }
  else {
    return e;
  }
};

Float32Array.prototype.clip = function(g) {
  return this.map(clip(g));
};

Float32Array.prototype.modulate = function(carrier) {
  return this.map((e,i) => e * (1 + carrier[i]));
};

Float32Array.prototype.applyFilter = function(clause) {
  let output = this.slice();
  let filterOutput = i => clause(this, output, i);

  for (let i = 0; i < numSamples; i++) {
    output[i] = filterOutput(i);
  }

  return output;
};

const average = (e, i, x) => {
  if (i >= 1) {
    return 0.5 * (x[i] + x[i - 1]);
  } else {
    return e;
  }
};

const index = (varOrArray, i) => {
  if (!varOrArray.length) {
    return varOrArray;
  } else {
    return varOrArray[i];
  }
};

const whiteNoise = () => 2 * Math.random() - 1;
const sin = (f, phase = 0) => (t, i) => Math.sin(2 * Math.PI * f * t + index(phase, i));
const saw = f => t => 2 * (f * t - Math.floor(0.5 + f * t));
const square = (f, phase = 0) => (t, i) => clip(1)(sin(f, phase)(t, i) * 1000);
const phasor = f => t => (f * t) % 1;
const triangle = f => t => 2 * Math.abs(saw(f)(t)) - 1;
const sinDamped = (f, tau, phase = 0) => t => Math.exp(- t / tau) * sin(f, phase)(t);
const pow = Math.pow;

const comb = (g1, g2, m1, m2) => (input, output, i) => {
  let x_m1 = 0;
  let y_m2 = 0;

  if (i - m1 >= 0) {
    x_m1 = input[i - m1];
  }
  if (i - m2 >= 0) {
    y_m2 = output[i - m2];
  }

  return input[i] + g1 * x_m1 - g2 * y_m2;
};

/*
const biQuad = (g, b1, b2, a1, a2) => (input, output, i) => {
  if (i >= 2){
    return g * (input[x] + b1 *
  }
};
*/

const highPass = (b1, b2) => (input, output, i) => {
  if (i >= 1){
    return b1 * input[i] + b2 * input[i - 1];
  } else {
    return b1 * input[i];
  }
};

const lowpass = alpha => (input, output, i) => {
  if (i >= 1) {
    return alpha * input[i] +  (1 - alpha) * output[i - 1];
  } else {
    return alpha * input[i];
  }
};

let time, numSamples;

const updateTime = () => {
  if(!time){
    time = new Float32Array(numSamples).fill(0);
    time = time.map((e,i) => e + i / sampleRate);
  }
  else{
    time = time.map(t => t + numSamples / sampleRate);
  }
};
`;

const defaultCode = `function setup() {
}

function loop() {
  return time
    .map(sin(440))
    .mult(0.1);
}
`;


var synth = (function () {
  let analyser;
  let sound, audio;
  let editor;
  let processorCount = 0;

  document.querySelector('#editor').innerHTML = defaultCode;
  editor = ace.edit("editor");
  editor.setTheme("ace/theme/clouds");
  editor.session.setMode("ace/mode/javascript");
  editor.session.setOptions({ tabSize: 2, useSoftTabs: true });
  editor.setFontSize(16);

  function getCode(userCode, processorName){
    return `data:text/javascript;utf8,
  ${libraryCode}
  ${userCode}
  setup(); // this runs once

  // stuff below is the standard way to start an audioProcessor
  class AudioProcessor extends AudioWorkletProcessor {

    constructor(options) {
      super(options);
    }

    process(inputs, outputs, parameters) {
      let input = inputs[0][0];
      let output = outputs[0][0];
      if(!numSamples){
        numSamples = output.length;
      }

      // calls to custom functions (these run on every frame of 128 samples)
      updateTime();
      output.set(loop().clip(0.5));

      return true;
    }
  }

  registerProcessor('${processorName}', AudioProcessor);
    `;
  }

  function startWorklet(userCode){
    let processorName = 'audio-processor' + processorCount;
    processorCount++;

    let moduleDataUrl = getCode(userCode, processorName);

    if (!audio) {
      audio = new AudioContext();
    }

    // Loads module script via AudioWorklet.
    audio.audioWorklet.addModule(moduleDataUrl).then(() => {
      sound = new AudioWorkletNode(audio, processorName);
      analyser = audio.createAnalyser();
      sound.connect(audio.destination);
      sound.connect(analyser);
      draw();
    });
  }

  function load(userCode) {
    editor.session.setValue(userCode);
  }

  document.getElementById("play").onclick = function(){
    var updatedCode = editor.getSession().getValue();
    if(sound) {sound.disconnect();}
    startWorklet(updatedCode);
  };

  document.getElementById("stop").onclick = function(){
    if (sound) {sound.disconnect();}
  };

  // Spectrum Analyser from https://codepen.io/ContemporaryInsanity/pen/Mwvqpb

  var scopeCtx = document.getElementById('scope').getContext('2d');
  var spectCtx = document.getElementById('spectrum').getContext('2d');

  function draw() {
    drawSpectrum(analyser, spectCtx);
    drawScope(analyser, scopeCtx);

    requestAnimationFrame(draw);
  }

  function drawSpectrum(analyser, ctx) {
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    var freqData = new Uint8Array(analyser.frequencyBinCount);
    var scaling = height / 256;

    analyser.getByteFrequencyData(freqData);

    ctx.fillStyle = '#eef5db';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'dodgerblue';
    ctx.beginPath();

    for (var x = 0; x < width; x++)
      ctx.lineTo(x, height - freqData[x] * scaling - 1);

    ctx.stroke();
  }

  function drawScope(analyser, ctx) {
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    var timeData = new Uint8Array(analyser.frequencyBinCount);
    var scaling = height / 256;
    var risingEdge = 0;
    var edgeThreshold = 5;

    analyser.getByteTimeDomainData(timeData);

    ctx.fillStyle = '#eef5db';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'dodgerblue';
    ctx.beginPath();

    // No buffer overrun protection
    while (timeData[risingEdge++] - 128 > 0 && risingEdge <= width);
    if (risingEdge >= width) risingEdge = 0;

    while (timeData[risingEdge++] - 128 < edgeThreshold && risingEdge <= width);
    if (risingEdge >= width) risingEdge = 0;

    for (var x = risingEdge; x < timeData.length && x - risingEdge < width; x++)
      ctx.lineTo(x - risingEdge, height - timeData[x] * scaling);

    ctx.stroke();
  }

  return {
    load: load
  };

})();