Float32Array.prototype.add = function(v) {
  return this.map(add(v));
};

Float32Array.prototype.sub = function(v) {
  return this.map(sub(v));
};

Float32Array.prototype.mult = function(s) {
  return this.map(mult(s));
};

Float32Array.prototype.div = function(s) {
  return this.map(div(s));
};

Float32Array.prototype.delay = function(m) {
  return this.map(delay(m));
};


Float32Array.prototype.applyFilter = function(clause) {
  let output = this.slice();
  let filterOutput = i => clause(this, output, i);

  for (let i = 0; i < numSamples; i++) {
    output[i] = filterOutput(i);
  }

  return output;
};

const mult = s => e => e * s;
const div = s => e => e * s;
const add = v => (e, i) => e + v[i];
const sub = v => (e, i) => e - v[i];

let time;
let numSamples;

/*
const zip = (f, a, b) => a.map((e, i) => f(e, b[i]));
const spread = (f, ...args) => args.reduce((sum, e) => zip(f, sum, e));
const sum = (x,y) => x + y;
const diff = (x,y) => x - y;
const mult = (x,y) => x * y;
const div = (x,y) => x / y;
*/

const clip = (e, val = 0.1) => {
  let max = Math.abs(val);
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

const delay = m => (e, i, x) => x[(i + m) % numSamples];

const average = (e, i, x) => {
  if (i >= 1) {
    return 0.5 * (x[i] + x[i - 1]);
  } else {
    return e;
  }
};

const whiteNoise = t => 2 * Math.random() - 1;
const sin = f => t => Math.sin(2 * Math.PI * f * t);
const saw = f => t => 2 * (f * t - Math.floor(0.5 + f * t));
const square = f => t => clip(sin(f)(t) * 100000, 1);
const phasor = f => t => (f * t) % 1;

const sinDamped = (f, tau) => t => Math.exp(- t / tau) * sin(f)(t);

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

const updateTime = () => {
  if(!time){
    time = new Float32Array(numSamples).fill(0);
    time = time.map((e,i) => e + i / sampleRate);
  }
  else{
    time = time.map(t => t + numSamples / sampleRate);
  }
};

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
    loop(input, output);

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
