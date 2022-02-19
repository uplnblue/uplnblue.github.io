// UI
var testMode = false;
var intendedNote = ["C",3];
// clean up this stuff, when you make the test mode
var playedNotesBuffer;
var playedNotesBuffer2;
function PlayedNotesBuffer2(props) {
  this.nullSampleLimit = props.nullSampleLimit;
  this.intendedNote = props.intendedNote;
  // this.nullNote = props.nullNote;

  this.startTime = 0;
  this.firstNoteTime = 0;
  this.lastNoteTime = 0;
  this.endTime = 0;
  this.firstNoteIndex = 0;

  this.times = [];
  this.samples = [];
  this.errors = [];

  this.consecutiveNullSamples = 0;
  this.seenNote = false;
  this.ended = false;

  this.addNote = function(note, currentTime) {
    this.times.push(currentTime);
    this.samples.push(note);
    this.errors.push(encode_note(note, this.intendedNote, noteErrorCodes));

    if (note) {
      if (!this.seenNote) {
        this.seenNote = true;
        this.firstNoteTime = currentTime;
        this.firstNoteIndex = this.samples.length;
      }
      this.consecutiveNullSamples = 0;
      this.lastNoteTime = currentTime;
    } else if (this.consecutiveNullSamples < this.nullSampleLimit) {
      // wait
      this.consecutiveNullSamples = this.consecutiveNullSamples + 1;
    } else if (this.seenNote) {
      // end sampling
      this.endTime = currentTime;
      this.ended = true;
      console.dir(this.errors.slice(this.firstNoteIndex, this.errors.length));
    }
  }
}

function PlayedNotesBuffer(props) {
  this.windowSize = props.windowSize;
  this.buffer = [];
  this.numCalls = 0;
  this.noteStats = {};
  this.sampleInterval = soundProcessingInterval;
  this.nullSample = [];

  this.addNote = function(note) {
    if (note) {

    }

    let newLength = this.buffer.push(note);
    if (newLength >= this.windowSize) {
      this.buffer = this.buffer.slice(0, this.windowSize);
    }
    let noteName = `${note[0]}${note[1]}`;
    if (this.noteStats.hasOwnProperty(noteName)) {
      this.noteStats[noteName] = this.noteStats[noteName] + 1;
    } else {
      this.noteStats[noteName] = 1;
    }

    this.numCalls = this.numCalls + 1;
    if (this.numCalls%this.windowSize == 0) {
      console.dir(this.noteStats);
      this.noteStats = {};
    }
  }
  this.getBuffer = function() {
    return this.buffer;
  }
}

const noteErrorCodes = {
  CORRECT: 4,
  OCTAVE: 3,
  OVERTONE: 2,
  OTHER: 1,
  NULL: 0
}

function is_power_of_two(x) {
  return (x & (x - 1)) == 0
}

const encode_note = function(note, intendedNote, errorCodes) {
  if (!note) {
    // console.log('NO NOTE');
    return errorCodes.NULL;
  }
  // note[0] = closest_note, note[1] = octave,
  // note[2] = closest_pitch, note[3] = maxFreq

  // intendedNote[0] = note, intendedNote[1] = octave
  // intendedNote[2] = intendedNote[3] = frequency

  var intendedPitch = get_pitch_from_note(intendedNote)
  var closestPitch = note[2]
//  var nextSemitone = get_semitone_distance(intendedPitch);
  console.log(intendedPitch, closestPitch);
  if (intendedPitch == closestPitch) {
    return errorCodes.CORRECT;
  } else {
    // catagorize error
    console.log(intendedPitch > closestPitch);
    let ratio = (intendedPitch > closestPitch) ? intendedPitch / closestPitch : closestPitch / intendedPitch;
    console.log(`ratio:${ratio}`);
    if ((ratio - Math.round(ratio)) < 0.01) {
      let multiple = Math.round(ratio);
      console.log(`multiple:${multiple}`);
      if (is_power_of_two(multiple)) {
          return errorCodes.OCTAVE;
      } else {
          return errorCodes.OVERTONE;
      }
      } else {
        return errorCodes.OTHER;
      }
  }
}


function start_test_mode() {

  playedNotesBuffer2 = new PlayedNotesBuffer2({
    nullSampleLimit: 50,
    intendedNote: intendedNote,
  })

}



// function outputTimestamps() {
//   let ts = audioCtx.getOutputTimestamp()
//   console.log('Context time: ' + ts.contextTime + ' | Performance time: ' + ts.performanceTime);
//   rAF = requestAnimationFrame(outputTimestamps);
// }
