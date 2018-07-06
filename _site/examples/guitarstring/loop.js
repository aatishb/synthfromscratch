let amp = 0.1;
let noiseWave;

function setup() {
  noiseWave = new Float32Array(128)
    .map(whiteNoise)
    .mult(amp);
}

function loop() {
  noiseWave = noiseWave.delay(1).map(average);
  return noiseWave;
}
