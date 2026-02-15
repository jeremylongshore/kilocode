export const messageStyles = {
  kiloSpeaks: {
    variants: [
      '💬 > [KILO OUTPUT]',
      '🔹 *Kilo whispers through the datastream...*',
    ],
  },
  kiloThinks: {
    variants: ['🤔 :: compiling thoughts ::', '⚡ *Neural circuits buzzing...*'],
  },
  createdFile: {
    variants: [
      '✨ 📁 + touch <filename>',
      '🪄 *Kilo conjured <filename> from raw bits!*',
    ],
  },
  updatedFile: {
    variants: ['🔧 ⚙️ patch <filename>', '🧠 *Refined logic — now optimized.*'],
  },
  deletedFile: {
    variants: ['💣 🗑 rm -rf <filename>', '🫥 *<filename> erased from reality.*'],
  },
  renamedFile: {
    variants: ['🎭 mv <old> → <new>', '🔄 *<old> now masquerades as <new>.*'],
  },
  savedChanges: {
    variants: ['💾 write() successful', '🌙 *Data crystallized and saved.*'],
  },
  runningCommand: {
    variants: ['🚀 $ <command>', '⚙️ *Engines roaring... executing.*'],
  },
  commandSuccess: {
    variants: ['✅ exit code 0', '🌟 *Smooth execution.*'],
  },
  commandFailed: {
    variants: ['💀 exit code 1', '⚡ *Error pulse detected.*'],
  },
  taskAdded: {
    variants: ['🧠 #TODO: <task>', '📜 *New mission logged.*'],
  },
  taskUpdated: {
    variants: ['🔧 ~ task.refresh()', '♻️ *Progress evolving...*'],
  },
  taskComplete: {
    variants: ['🎉 [✓] done()', '💚 *Objective achieved.*'],
  },
  allTasksDone: {
    variants: [
      '🌌 #TODO list → null',
      '🕊 *System calm. Awaiting new directive.*',
    ],
  },
};

export const ambientLines = [
  'CPU dreams in assembly...',
  'Listening to the hum of electrons...',
  'Awaiting next directive, Commander 🧑‍💻',
  'Recalibrating neural cores...',
  'Memory map synchronized.',
];

export const modeTransitionTexts = {
  Architect: '🧩 Architect Mode engaged — drafting blueprints...',
  Code: '💻 Code Mode active — logic streaming...',
  Debug: '🕵️ Debug Mode initiated — scanning for anomalies...',
  Todo: '📋 Task Mode online — managing operations...',
  Explain: '🧠 Explain Mode enabled — decoding complexity...',
};
