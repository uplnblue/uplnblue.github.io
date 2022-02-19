// "Notarinos" app to help guitarists learn the fretboard
// MIT License
// Copyright (c) 2022 uplnblue

// GENERAL APP CONTROLS
var audioRunning = false;
var animationRunning = false;
// context and nodes
var audioContext;
var analyser;
// set canvases height and width
var intendedWidth = document.querySelector('#stage').clientWidth;
var intendedHeight = document.querySelector('#stage').clientHeight;
var tuningWidth = document.querySelector('#tuningControls').clientWidth;
var tuningHeight = document.querySelector('#tuningControls').clientHeight;
// fretboard
const canvasFretboard = document.getElementById('fretboard');
canvasFretboard.setAttribute('width', intendedWidth);
canvasFretboard.setAttribute('height', intendedHeight);
// visuals
const canvasVisuals = document.getElementById('visualization');
canvasVisuals.setAttribute('width', intendedWidth);
canvasVisuals.setAttribute('height', intendedHeight);
// tuning
const canvasTuning = document.getElementById('tuning');
canvasTuning.setAttribute('width', tuningWidth);
canvasTuning.setAttribute('height', tuningHeight);
// Canvas Contexts
const ctxF = canvasFretboard.getContext('2d');
const ctxV = canvasVisuals.getContext('2d');
const ctxT = canvasTuning.getContext('2d');

// tuning stuff
const tuningElements = [];
const tuningNotes = [];
const tuningGraphics = [];

// drawnNotes is reset in start/stop functions
const drawnNotes = {};

// references to animations
const allAnimations = [];

// references to sound processing setintervals
const allTimeouts = [];
var soundProcessingInterval = 10; //every x ms call process_audio_input

// draw notes animation
function draw_notes() {
  draw_notesAnimation = requestAnimationFrame(draw_notes);
  for (const [key, note] of Object.entries(drawnNotes)) {
    note.draw()
  }
  allAnimations.push(draw_notesAnimation);
}

const colors = {
  "F#": ['#d50000', '#ff1744', '#ff5252', '#ff8a80'], // red
  "C#": ['#c51162', '#f50057', '#ff4081', '#ff80ab'], // pink
  "G#": ['#aa00ff', '#d500f9', '#e040fb', '#ea80fc'], // purple
  "D#": ['#6200ea', '#651fff', '#7c4dff', '#b388ff'], // deepPurple
  "A#": ['#304ffe', '#3d5afe', '#536dfe', '#8c9eff'], // indigo
  "F": ['#2962ff', '#2979ff', '#448aff', '#82b1ff'], // blue
  "C": ['#0091ea', '#00b0ff', '#40c4ff', '#80d8ff'], // lightBlue
  "G": ['#00b8d4', '#00e5ff', '#18ffff', '#84ffff'], // cyan
  "D": ['#00bfa5', '#1de9b6', '#64ffda', '#a7ffeb'], // teal
  "A": ['#00c853', '#00e676', '#69f0ae', '#b9f6ca'], // green
  "E": ['#64dd17', '#76ff03', '#b2ff59', '#ccff90'], // lightGreen
  "B": ['#aeea00', '#c6ff00', '#eeff41', '#f4ff81'] // lime
}

const CONCERT_PITCH = 440; // 440 Hz, A4
// i = 12 * log2(fn / fr), where i is the integer number and direction of semitones away from the reference frequency
// With CONCERT_PITCH, 'A', at index 0 of NOTES, log(440/440) = 0, so can use i as in index into NOTES
const NOTES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
// Octaves begin at 'C'
const index_C = 3;

const notesDict = {};

function intialise_notes_dict() {
  NOTES.forEach((note, i) => {
    notesDict[note] = {
      '1': {
        'stringPositions': [],
        'color': colors[note][3]
      },
      '2': {
        'stringPositions': [],
        'color': colors[note][0]
      },
      '3': {
        'stringPositions': [],
        'color': colors[note][1]
      },
      '4': {
        'stringPositions': [],
        'color': colors[note][2]
      },
      '5': {
        'stringPositions': [],
        'color': colors[note][3]
      },
    }
  });
}

// margins
const H_MARGIN = 30; // x position of first string area
const V_MARGIN = 25; // y position of nut
//  0 is the nut; 13 is the second octave fretMarker
const fretMarkerPositions = [3, 5, 7, 9, 12, 13];
// space for each string's animations
var stringSpace = (canvasFretboard.width - (2 * H_MARGIN)) / 6;
var stringLength = canvasFretboard.height - (2 * V_MARGIN)
// nut, fretMarkers, strings, and frets are all reset to current dimenions when their draw functions run
const nut = [];
const fretMarkers = [];
const strings = [];
const frets = [];

// UI
var animate = true;
//var tuning = false;
var lefty = false;
var fadeIncrement = 0.04;
//


function stop_animations(animations) {
  animations.forEach((animation, i) => {
    cancelAnimationFrame(animation);
  });
}

function stop_sound_processing(timeouts) {
  timeouts.forEach((timeout, i) => {
    clearInterval(timeout);
  });
}

// DOM
var ALL_TUNING_CHOICES = [];
function generate_all_tuning_choices(startNote, endNote) {
  ALL_TUNING_CHOICES = [];
  let tuningChoices = [];
  let startIndex = NOTES.indexOf(startNote[0]);
  let startOctave = startNote[1];
  let endIndex = NOTES.indexOf(endNote[0]);
  let endOctave = endNote[1];

  let maxIndex = get_semitones_distance(startNote, endNote);
  for (let i = 0; i <= maxIndex; i++) {
    let nextNote = generate_next_note(startNote, i);
    ALL_TUNING_CHOICES.push(nextNote)
  }
  return ALL_TUNING_CHOICES;
}



// adding index into ALL_TUNING_CHOICES for simplicity
const STANDARD_TUNING = [
  ['E', 2, 4],
  ['A', 2, 9],
  ['D', 3, 14],
  ['G', 3, 19],
  ['B', 3, 23],
  ['E', 4, 28]
];

var get_tuning_from_ui = function() {
  let uiTuning = [];
  tuningNotes.forEach((tuningNote, i) => {
    uiTuning[tuningNote.stringIndex] = ALL_TUNING_CHOICES[tuningNote.currentIndex];
  });
  return uiTuning;
}

function tune_standard_tuning() {
  console.log('called tune_standard_tuning');
  tune_strings(STANDARD_TUNING);
}

function tune_strings(tuning) {
  // clear previous tuning
  intialise_notes_dict();
//   console.log('tune_strings called');
//   console.dir(tuning);
  try {
    if (tuning) {
      tuning.forEach((note, string) => {
        assign_notes_to_string(string, note);
      });

    } else {
      tune_standard_tuning();
    }
  } catch(e) {
    // console.log(e);
    // console.dir(tuning);;
    tune_standard_tuning();
  }
}

const tune_standard_tuning_ui = function() {
  tuningNotes.forEach((el, i) => {
    el.tuneStandardTuning();
  });
  // tuneLive will do nothing if we are not live, but ensures order if we are Live
  tune_live();
}



function populate_tuning_graphics() {
  document.querySelectorAll('.tuningGraphic').forEach((el, i) => {
    let tuningControlEl = el.parentElement;
    let stringIndex = parseInt(tuningControlEl.dataset.stringnum);

    let tuningGraphicEl = new TuningGraphic({
      tuningGraphicEl: el,
      stringIndex: stringIndex
    });

    tuningGraphics[stringIndex] = tuningGraphicEl;

  });
}
function populate_tuning_notes() {
  document.querySelectorAll('.tuningNote').forEach((el, i) => {
    let tuningControlEl = el.parentElement;
    let stringIndex = parseInt(tuningControlEl.dataset.stringnum);
    let tuningNoteEl = new TuningNote({
      tuningNoteElement: el,
      stringIndex: stringIndex
    });
    let tuningControlElements = [];
    tuningControlElements[0] = el.parentElement.querySelector('.tuneUp');
    tuningControlElements[1] = el.parentElement.querySelector('.tuneDown');
    tuningNoteEl.registerNote(tuningControlElements);
    // save each note
    tuningNotes[stringIndex] = tuningNoteEl;
  });
}



// TUNING Canvas
function TuningElement(props) {
  this.stringNum = parseInt(props.stringNum);
  this.width = props.width;
  this.height = props.height;
  this.x = props.x;
  this.y = props.y;
  this.rightEdge = props.right;
  this.leftEdge = props.x;

  this.circleFromRight = this.stringNum <= 2;

  this.getCenterPoint = function() {
    let centerPoint = [];
    centerPoint[0] = this.x + (this.width / 2);
    centerPoint[1] = this.y + (this.height / 2);
    return centerPoint;
  }

  this.getCircleStartPoint = function() {
    let circleStartPoint = [];
    circleStartPoint[0] = (this.circleFromRight) ? this.rightEdge + (strings[this.stringNum].width / 2) : this.x - (strings[this.stringNum].width / 2);
    circleStartPoint[1] = this.getCenterPoint()[1];
    return circleStartPoint;
  }

  this.getLineStartPoint = function() {
    let lineStartPoint = [];
    lineStartPoint[0] = strings[this.stringNum].x;
    lineStartPoint[1] = canvasTuning.height;
    return lineStartPoint;
  }
  // at the moment, we just have to call the class methods after the strings are drawn
  this.lineStartPoint = this.getLineStartPoint();
  this.circleStartPoint = this.getCircleStartPoint();
  this.centerPoint = this.getCenterPoint();

  // all this circle to right stuff is uncessesarry
  this.draw = function() {
    ctxT.save();
    ctxT.lineWidth = strings[this.stringNum].width;
    // ctxT.strokeStyle = 'black';
    ctxT.lineJoin = 'round';

    ctxT.beginPath();
    ctxT.moveTo(this.lineStartPoint[0], this.lineStartPoint[1] + 0.5);
    ctxT.lineTo(this.circleStartPoint[0], this.circleStartPoint[1]);

    let sAngle = this.circleFromRight ? 0 : Math.PI;
    let eEngle = this.circleFromRight ? Math.PI : 0;
    let ccw = this.circleFromRight ? true : false;
    ctxT.arc(this.centerPoint[0], this.centerPoint[1], ((this.width / 2) + (ctxT.lineWidth / 2)), sAngle, eEngle, ccw);

    ctxT.stroke();
    ctxT.restore();
  }
}

// TODO: aria role button, clickable elements

function TuningGraphic(props) {

  this.domElement = props.tuningGraphicEl;
  this.stringIndex = props.stringIndex;
  this.currentAngle = 0;

  this.rotate = function(direction) {
    let sign;
    if (direction == 'up') {
      sign = this.stringIndex <= 2 ? -1 : 1;
    } else if (direction == 'down') {
      sign = this.stringIndex <= 2 ? 1 : -1;
    }

    this.domElement.setAttribute("style", `transform: rotate(${(this.currentAngle + (sign * 30))}deg)`);
    this.currentAngle = this.currentAngle + (sign * 30);
    //console.log(this.currentAngle);
  }
}

function TuningNote(props) {
  this.domElement = props.tuningNoteElement;
  this.stringIndex = parseInt(props.stringIndex);
  this.currentIndex = parseInt(this.domElement.dataset.currentindex);
  //this.currentNote = ALL_TUNING_CHOICES(this.currentIndex);
  this.standardIndex = STANDARD_TUNING[this.stringIndex][2];

  this.changeNote = (e) => {
  //console.log('change note called');
  //console.log(e.code, e.target.direction);
  //console.log(this);
  //console.log(this.domElement);
    if (e && e.code) {
      console.log(e.code);
      if (!(e.code == 'Enter' || e.code =='Space')) {
        return;
      }
    }
    let direction = e.target.direction;
    let oldIndex = this.currentIndex;
    if (direction == 'up') {
      this.currentIndex = Math.min(this.currentIndex + 1, ALL_TUNING_CHOICES.length - 1);

    } else if (direction == 'down') {
      this.currentIndex = Math.max(this.currentIndex - 1, 0)
    }
    this.domElement.dataset.currentindex = this.currentIndex;
    // rotate associated graphic
    if (oldIndex != this.currentIndex) {
      tuningGraphics[this.stringIndex].rotate(direction);
    }

    this.domElement.innerHTML = `${ALL_TUNING_CHOICES[this.currentIndex][0]}${ALL_TUNING_CHOICES[this.currentIndex][1]}`;

    // tuneLive will return if we're not Live, otherwise, calling it here ensures it happens after Change Note.
    tune_live();
  }

  // use the control to remove the "anonymous"? event handlers.  this.changeNote counts as anonymous.
  this.controller = new AbortController();

  this.registerNote = function(tuningControlElements) {
    tuningControlElements[0].direction = 'up';
    tuningControlElements[1].direction = 'down';
    tuningControlElements[0].addEventListener('click', this.changeNote, {signal: this.controller.signal});
    tuningControlElements[1].addEventListener('click', this.changeNote, {signal: this.controller.signal});
    tuningControlElements[0].addEventListener('keydown', this.changeNote, {signal: this.controller.signal});
    tuningControlElements[1].addEventListener('keydown', this.changeNote, {signal: this.controller.signal});
  }

  this.tuneStandardTuning = function() {
  //  console.log('tuning note element tune standard tuning called');
    let note = ALL_TUNING_CHOICES[parseInt(this.standardIndex)];
    this.currentIndex = this.standardIndex;
    this.domElement.dataset.currentIndex = this.standardIndex;
    this.domElement.innerHTML = `${note[0]}${note[1]}`;
  }
}

// FRETBOARD Canvas

function Fret(props) {
  this.index = parseInt(props.fretNumber);
  this.y = props.posY;
  this.fretNumber = parseInt(props.fretNumber);
  this.width = 14;
  this.draw = function() {
    //  ctxF.fillStyle = #b0bec5'#e3a58f';
    ctxF.fillStyle = '#b0bec5';
    ctxF.beginPath();
    ctxF.moveTo(canvasFretboard.width, this.y);
    ctxF.lineTo(0, this.y + (this.width / 2));
    ctxF.lineTo(0, this.y - (this.width / 2));
    ctxF.fill();
  }
  frets[this.index] = this;
}

function Nut(props) {
  this.y = V_MARGIN;
  this.width = 10;
  this.draw = function() {
    //TODO: fix colors
    ctxF.lineWidth = this.width;
    ctxF.beginPath();
    ctxF.moveTo(0, this.y);
    ctxF.lineTo(canvasFretboard.width, this.y);
    ctxF.stroke();
  }
  // save nut
  nut[0] = this;
}

function FretMarker(props) {
  this.index = props.posN;
  this.y = props.posY;
  this.x = props.posX;
  this.radius = 12.5;
  this.draw = function() {
    ctxF.fillStyle = '#eddfd9';
    ctxF.beginPath();
    ctxF.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
    ctxF.fill();
  }
  // save fretMarker
  fretMarkers[this.index] = this;
}


function draw_canvas_visuals() {

  function get_string_position(stringNumber) {
    return H_MARGIN + parseInt(0.5 * stringSpace) + parseInt(stringNumber * stringSpace);
  }

  // create Strings
  for (let i = 0; i < 6; i++) {
    void new String({
      "stringNumber": i,
      "posX": get_string_position(i),
    });
    strings[i].draw();
  }

}

function draw_canvas_tuning() {
  // create tustringsningElements..
  let tuningControlsRect = document.getElementById('tuningControls').getBoundingClientRect();

  document.querySelectorAll('.tuningControl').forEach((el, i) => {
    let tuningRect = el.getBoundingClientRect();
    let thisIndex = parseInt(el.dataset.stringnum);
    let tuningEl = new TuningElement({
      width: tuningRect.width,
      height: tuningRect.height,
      x: tuningRect.x - tuningControlsRect.x,
      y: tuningRect.y - tuningControlsRect.y,
      right: tuningRect.right - tuningControlsRect.x,
      stringNum: thisIndex
    });
    tuningElements[thisIndex] = tuningEl;
    tuningEl.draw();
  });
}


function draw_canvas_fretboard() {

  function distance_nut_to_fret(totalStringLength, fretNumber) {
    let distance = totalStringLength - (totalStringLength / (2 ** (fretNumber / 12)));
    return distance;
  }

  //create frets
  for (let i = 0; i < 13; i++) {
    new Fret({
      "fretNumber": i,
      "posY": V_MARGIN + distance_nut_to_fret(2 * (stringLength), i),
    });
    // don't draw the fret over the nut, but save its position
    if (i != 0) {
      frets[i].draw();
    }
  }




  function midpoint(c1, c2) {
    return c1 + ((c2 - c1) / 2);
  }

  // create fretMarkers
  fretMarkerPositions.forEach(function(posNumber) {
    if (posNumber == 13) {
      void new FretMarker({
        "posN": posNumber,
        "posY": midpoint(frets[posNumber - 2].y, frets[posNumber - 1].y),
        "posX": canvasFretboard.width - H_MARGIN
      })
      fretMarkers[posNumber].draw();
    } else {
      void new FretMarker({
        "posN": posNumber,
        "posY": midpoint(frets[posNumber - 1].y, frets[posNumber].y),
        "posX": H_MARGIN
      })
      fretMarkers[posNumber].draw();
    }
  });

  // create nut
  void new Nut({});
  nut[0].draw();
}

// tune FUNCTIONS

function generate_next_note(thisNote, direction) {
  let refIndex = NOTES.indexOf(thisNote[0]);
  let startOctave = thisNote[1];
  let nextNote = [];

  nextNote[0] = NOTES[(refIndex + direction) % 12];
  nextNote[1] = startOctave + Math.floor((((12 - (index_C - refIndex)) % 12) + direction) / 12);

  return nextNote;
}

// 0 is thickest string, 5 is thinest
function assign_notes_to_string(stringNumber, startNote) {
  //let stringNotes = [];
  for (let i = 0; i < 13; i++) {
    let nextNote = generate_next_note(startNote, i);
    notesDict[nextNote[0]][nextNote[1]].stringPositions.push([stringNumber, i]);
    //stringNotes.push(nextNote);
  }
  //console.dir(stringNotes);
}

function get_semitones_distance(startNote, endNote) {
  let refPitch = get_pitch_from_note(startNote);
  let endPitch = get_pitch_from_note(endNote);
  let i = parseInt(12 * Math.log2(endPitch / refPitch));
  return i;
}


// VISUALS CANVAS

function String(props) {
  this.index = parseInt(props.stringNumber);
  // posX represents the center
  this.x = props.posX;
  this.evenWidths = [8, 6, 6, 4, 4, 4];
  this.oddWidths = [7, 5, 5, 3, 3, 3];
  this.draw = function() {
    ctxV.save();

    ctxV.beginPath();
    // choose line-width so that pixels are fully filled
    if (Number.isInteger(this.x)) {
      this.width = this.evenWidths[this.index];
      ctxV.lineWidth = this.evenWidths[this.index];
    } else if (Number.isInteger(Math.round(this.x * 2) / 2)) {
      this.x = Math.round(this.x * 2) / 2;
      this.width = this.evenWidths[this.index];
      ctxV.lineWidth = this.evenWidths[this.index];
    } else {
      this.x = Math.round(this.x * 2) / 2;
      this.width = this.oddWidths[this.index];
      ctxV.lineWidth = this.oddWidths[this.index];
    }
    ctxV.moveTo(this.x, 0);
    ctxV.lineTo(this.x, canvasFretboard.height);
    ctxV.stroke();

    ctxV.restore();
  }
  // save string
  strings[this.index] = this;
}

function Note(props) {
  this.name = props.name;
  this.octave = props.octave;
  this.stringNumber = props.stringNumber;
  this.fretNumber = props.fretNumber;
  this.fullName = `${this.name}${this.octave}${this.stringNumber}${this.fretNumber}`;
  this.radius = 15;
  this.alpha = 1;
  this.radiusIncrement = (fadeIncrement/this.alpha) * this.radius;

  this.getXYCoordinates = function(stringNumber, fretNumber) {
    let x = strings[stringNumber].x;
    let y = frets[fretNumber].y - this.radius;
    return [x, y];
  }


  this.generateRGBA = function(noteHex, noteAlpha) {
    let r = parseInt(noteHex.slice(1, 3), 16),
      g = parseInt(noteHex.slice(3, 5), 16),
      b = parseInt(noteHex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${noteAlpha})`;
  }

  this.draw = function() {
    ctxF.save();
    ctxV.save();
    ctxT.save();
    if (this.alpha > 0) {
      let xyCoords = this.getXYCoordinates(this.stringNumber, this.fretNumber);

      ctxV.strokeStyle = this.generateRGBA(notesDict[this.name][this.octave].color, this.alpha);

      strings[this.stringNumber].draw();
      ctxV.fillStyle = this.generateRGBA("#000000", this.alpha);
      // 0 is the nut
      if (this.fretNumber > 0) {
        ctxV.clearRect(
          xyCoords[0] - (1.4 * this.radius * ctxV.lineWidth),
          xyCoords[1] - (1.4 * this.radius * ctxV.lineWidth),
          2 * (1.4 * this.radius * ctxV.lineWidth),
          2 * (1.4 * this.radius * ctxV.lineWidth)
        );

        ctxV.beginPath();
        ctxV.arc(xyCoords[0], xyCoords[1], this.radius, 0, Math.PI * 2, true);
        ctxV.fill();
        ctxV.stroke();
      } else {
        ctxT.strokeStyle = this.generateRGBA(notesDict[this.name][this.octave].color, this.alpha);
        ctxT.fillStyle = this.generateRGBA("#000000", this.alpha);

        tuningElements[this.stringNumber].draw();
      }


      this.alpha = Math.max(0,this.alpha - fadeIncrement);
      this.radius = (this.radius -  this.radiusIncrement) > 0 ? this.radius -   this.radiusIncrement : 0;

      drawnNotes[this.fullName] = this;
    } else {
      delete drawnNotes[this.fullName];
      strings[this.stringNumber].draw()
      tuningElements[this.stringNumber].draw();
    }
    ctxF.restore();
    ctxV.restore();
    ctxT.restore();
  }
}

// called on guitar input only
function draw_all_played_note(playedNote, playedOctave) {
  let allOctaves = notesDict[playedNote]
  for (const [octave, noteInfo] of Object.entries(allOctaves)) {
    let positions = noteInfo.stringPositions;
    if (positions.length) {
      positions.forEach((pos, i) => {
        let stringNum = pos[0];
        let fretNum = pos[1];
        let thisNote = new Note({
          "name": playedNote,
          "octave": octave,
          "stringNumber": stringNum,
          "fretNumber": fretNum,
        });
        thisNote.draw();
      });
    }
  }
}

// sound processing helper functions
function interp(arr, xVals) {
  let retArr = new Array(xVals.length)
  let v1, v2;
  for (let i = 0; i < xVals.length; i++) {
    v1 = arr[parseInt(xVals[i])];
    v2 = arr[parseInt(xVals[i] + 1)];
    v2 = isNaN(v2) ? v1 : v2;
    retArr[i] = (v2 - v1) * (xVals[i] - parseInt(xVals[i])) + v1;
  }
  return retArr;
}

function harmonic_product_spectrum(spectrum, numHPS) {
  hpsSpectrum = [...spectrum];
  hpsSpectrumSave = [...spectrum];

  let oldLength = spectrum.length;

  for (i = 0; i < numHPS; i++) {
    let j;

    let newLength = parseInt(Math.ceil(spectrum.length / (i + 1)));

    for (j = 0; j < newLength; j++) {
      hpsSpectrum[j] = hpsSpectrum[j] * spectrum[j * (i + 1)];
    }

    oldLength = newLength;

    const nonZero = (element) => element != 0;
    const greaterThanZero = (element) => element > 0;
    if (!hpsSpectrum.some(greaterThanZero)) {
      // stop harmonic product specturm calculations and use last saved spectrum
      //console.log(`${i}:zero or neg`);
      //console.log(hpsSpectrumSave.some(nonZero));
      if (hpsSpectrum.some(nonZero)) {
        console.log('some negative');
      }
      break;
    }
    hpsSpectrumSave = [...hpsSpectrum];
  }
  return hpsSpectrumSave;
}

// TODO visuals with closest_pitch
function get_closest_note(pitch) {
  // reference = A(0)4(4)
  let refIndex = 0;
  let startOctave = 4;

  const i = Math.round(Math.log2(pitch / CONCERT_PITCH) * 12);

  let closest_note = NOTES.at(i % 12).toString();

  let octave = startOctave + Math.floor((((12 - (index_C - refIndex)) % 12) + i) / 12);

  let closest_pitch = CONCERT_PITCH * 2 ** (i / 12);

  return [closest_note, octave, closest_pitch];
}

function get_pitch_from_note(note) {
  let refIndex = 0;
  let startOctave = 4;

  let i = NOTES.indexOf(note[0]);
  let intendedOctave = note[1];

  let calculatedOctave = startOctave + Math.floor((((12 - (index_C - refIndex)) % 12) + i) / 12);

  let pitch = CONCERT_PITCH * 2 ** (i / 12);

  let octaveDifference = intendedOctave - calculatedOctave;
  pitch = pitch * (2 ** octaveDifference);

  return pitch;
}

function get_semitone_distance(pitch) {
  let upSemitone = (pitch * 2 ** (1 / 12)) - pitch;
  let downSemitone = pitch - (pitch * 2 ** (-1 / 12));
  return [downSemitone, upSemitone];
}

// main processing that calls draw_all_played_note
function process_audio_input(sampleRate, analyser) {
  const NUM_HPS = 4; // how many harmonics, 5 for guitars
  const THRESHOLD_FREQ = 62;

  let bufferLength = analyser.frequencyBinCount;
  let spectrum = new Uint8Array(bufferLength);
  let maxFreq = '';

  analyser.getByteFrequencyData(spectrum);

  // suppress electrical noise
  let thresholdIndex = Math.ceil(THRESHOLD_FREQ * (analyser.fftSize / sampleRate));
  //console.log(analyser.frequencyBinCount/sampleRate);
  //console.log(thresholdIndex);
  for (let i = 0; i <= thresholdIndex; i++) {
    spectrum[i] = 0;
  }

  // Calculate signal power, don't process if too low
  let signalPower = spectrum.reduce((t, n) => t + n ** 2);
  if ((signalPower / spectrum.length) < (1.2)) {
    // console.log('low power');
    if (testMode) {
      if (!playedNotesBuffer2.ended) {
        playedNotesBuffer2.addNote(false, audioContext.getOutputTimestamp())
      }
    }
    return;
  }

  let interpFactor = 1 / NUM_HPS;
  let xVals = Array.from({
    length: NUM_HPS * spectrum.length
  }, (_, i) => i * interpFactor);
  //upsample spectrum to prepare for Harmonic Product Spectrum
  let interpSpectrum = interp([...spectrum], xVals);

  // do harmonic prodcut specturm
  let hpsSpectrum = harmonic_product_spectrum([...interpSpectrum], NUM_HPS);

  // get frequency with maximum magnitude
  let maxValHPS = Math.max(...hpsSpectrum);

  let indexOfMaxValue = hpsSpectrum.indexOf(maxValHPS);
  maxFreq = indexOfMaxValue * (sampleRate / analyser.fftSize / NUM_HPS);

  if (!(maxFreq < 1300)) {
    //console.log(`big max frequency: ${maxFreq}`);
    return;
  }

  // playedNote = [closet_note, octave, closest_pitch]
  let playedNote = get_closest_note(maxFreq);

  if (testMode) {
    if (!playedNotesBuffer2.ended) {
      playedNotesBuffer2.addNote(playedNote, audioContext.getOutputTimestamp())
    }
  }
  draw_all_played_note(playedNote[0], playedNote[1]);
}

// callbacks for getUserMedia
function soundAllowed(stream) {
  audioRunning = true;
  // store a reference to the stream
  window.refToAudioStream = stream;
  audioContext = new AudioContext({});
  var sampleRate = audioContext.sampleRate;
  // create audio source, nodes
  var audioStream = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();

  analyser.minDecibels = -80;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = .5 // default is 0.8
  analyser.fftSize = 32768;

  // connect nodes
  audioStream.connect(analyser);

  // call pitch detection function every x ms
  soundProcessingTimeout = setInterval(function() {
    process_audio_input(sampleRate, analyser)
  }, soundProcessingInterval);
  allTimeouts.push(soundProcessingTimeout);
}

function soundNotAllowed(error) {
  audioRunning = false;
  console.log(error);
}

function handleStartStopUI() {
  if (audioRunning) {
    document.getElementById('startStopNotarinos').setAttribute('style', 'z-index: 2;');
    document.getElementById('logo').setAttribute('style', 'fill:#eee; stroke: #eee;');
  } else {
    document.getElementById('startStopNotarinos').setAttribute('style', 'z-index: 3;');
    document.getElementById('logo').setAttribute('style','fill:#ff4141; stroke: #ff4141;');
  }
}

const start_stop_notarinos = function(e) {
  if (e && e.code) {
  //  console.log(e.code);
    if (!(e.code == 'Enter' || e.code =='Space')) {
      return;
    }
  }
  if (audioRunning) {
    stop_notarinos();
  } else {
    start_notarinos();
  }
}

function stop_notarinos() {
  stop_animations(allAnimations);
  stop_sound_processing(allTimeouts);
  // reset notes visuals.
  for (const note in drawnNotes) {
    delete drawnNotes[note];
  }

  // stop microphone
  audioContext.close();
  window.refToAudioStream.getTracks().forEach(function(track) {
    track.stop();
  });
  audioRunning = false;
  setup_initial_view();
}

function setup_initial_view() {
  console.log('setup_initial_view called');

  // set up tuning ui
  generate_all_tuning_choices(['C', 2], ['G', 4]);

  // remove existing unanmed event listners
  tuningNotes.forEach((tuningNote, i) => {
    tuningNote.controller.abort();
  });
  // make objects from DOM tuning control elements
  populate_tuning_notes();
  populate_tuning_graphics();

  // fretboard starts grey
  ctxF.save();
  ctxT.save();
  ctxV.save();

  ctxF.fillStyle = 'grey';
  ctxF.fillRect(0, 0, canvasFretboard.width, canvasFretboard.height);
  // tuning starts clear
  ctxT.fillStyle = 'rgba(0,0,0,0)';
  ctxT.fillRect(0, 0, canvasTuning.width, canvasTuning.height);
  // clear any remaining notes from visuals canvas.
  ctxV.clearRect(0, 0, canvasVisuals.width, canvasVisuals.height);

  ctxF.restore();
  ctxT.restore();
  ctxV.restore();
  // draw all convases
  draw_canvas_fretboard();
  draw_canvas_visuals();
  draw_canvas_tuning();

  let resetTuning = document.getElementById('tuneStandard');
  resetTuning.addEventListener('click', tune_standard_tuning_ui);

  let startStopNotarinos = document.getElementById('startStopNotarinos');
  startStopNotarinos.addEventListener('click',start_stop_notarinos, false);
  startStopNotarinos.addEventListener('keydown',start_stop_notarinos, false)

  //update Start-Stop button
  handleStartStopUI();
 }

// Main function
function start_notarinos() {
  // get ui tuning
  let tuning = [];
  try {
    tuning = get_tuning_from_ui();
  } catch(e) {
    console.log(e);
    tuning = [];
  }
  // clear everything and redraw
  // fretboard becomes white
  ctxF.fillStyle = 'white';
  ctxF.fillRect(0, 0, canvasFretboard.width, canvasFretboard.height);

  draw_canvas_fretboard()
  draw_canvas_visuals();
  draw_canvas_tuning();


  // tune strings from UI
  tune_strings(tuning);
  //start visuals
  draw_notes();

  // Request permission for microphone
  navigator.mediaDevices.getUserMedia({audio: true})
    .then(function(stream) {
      soundAllowed(stream)
    })
    .catch(function(err) {
      soundNotAllowed(err);
    })
    .finally(handleStartStopUI);
  }

// handles when tuning is called while the app is running
const tune_live = function(e) {
console.log("called tuneLive");
  if (e && e.code) {
  //  console.log(e.code);
    if (!(e.code == 'Enter' || e.code =='Space')) {
      return;
    }
  }

  if (audioRunning) {
    let tuning = get_tuning_from_ui();
    //console.dir(tuning);
    tune_strings(tuning);
  }
  return;
}


// start it up
setup_initial_view();
