// theme.js

export const darkTheme = {
  // ---- Core Background ----
  background: '#0A0E14',
  backgroundGradient: ['#0A0E14', '#0E141E', '#121A28'],
  cardBackground: '#10161F',
  codeBlocks: '#141C28',

  // ---- Primary Palette ----
  primary: '#00E0A3',
  secondary: '#33CFFF',
  accent: '#E000A3',
  highlight: '#00E0A3',
  dim: '#2A3440',

  // ---- Semantic Colors ----
  success: '#00E0A3',
  warning: '#E0A300',
  error: '#E04040',

  // ---- Text Colors ----
  primaryText: '#FFFFFF',
  secondaryText: '#D0D0D0',
  subduedText: '#606060',

  // ---- Borders & Shadows ----
  border: 'rgba(0, 224, 163, 0.15)',
  borderActive: 'rgba(0, 163, 224, 0.35)',
  shadow: 'rgba(0, 163, 224, 0.08)',

  // ---- Component-Specific ----
  commandHighlight: '#E0A300',
  costText: '#00A3E0',
  buttonText: '#FFFFFF',
  pathText: '#00E0A3',
  backgroundOverlay: 'rgba(10, 14, 20, 0.4)',
  pulseAnimation: 'rgba(0, 224, 163, 0.1)',
  bubbleColor: 'rgba(0, 163, 224, 0.35)',
  codeFlowColor: 'rgba(0, 224, 163, 0.35)',
  matrixColor: 'rgba(0, 224, 163, 0.7)',

  // ---- Gradients & Glow ----
  rainbowGradient: [
    '#7FDFA5', // soft muted mint
    '#4FD98C', // pleasant mid-lime
    '#25B97A', // balanced green-teal
    '#1E8C68', // rich jade tone
    '#0E5A45', // deep emerald anchor
  ],

  // ---- Syntax Highlighting ----
  syntax: {
    comment: '#606060',
    string: '#00E0A3',
    keyword: '#00A3E0',
    number: '#E0A300',
    className: '#00A3E0',
    function: '#00E0A3',
  },

  // ---- Mode Colors ----
  modes: {
    architect: '#00A3E0',
    code: '#00E0A3',
    debug: '#E04040',
    task: '#00A3E0',
    explain: '#E0A300',
  },

  // ---- Typography ----
  fonts: {
    main: 'JetBrainsMono-Regular',
    title: 'Orbitron-Regular',
    architect: 'IBMPlexSerif-Regular',
    medium: 'System',
    monospace: 'JetBrainsMono-Regular',
  },
};

export const lightTheme = {
  // ---- Core Background ----
  background: '#F5F7FA',
  backgroundGradient: ['#FFFFFF', '#F5F7FA', '#E8EEEF'],
  cardBackground: '#FFFFFF',
  codeBlocks: '#F0F2F5',

  // ---- Primary Palette ----
  primary: '#009688',
  secondary: '#007BFF',
  accent: '#E91E63',
  highlight: '#009688',

  dim: '#D0D5DA',

  // ---- Semantic ----
  success: '#009688',
  warning: '#FFC107',
  error: '#DC3545',

  // ---- Text ----
  primaryText: '#000000',
  secondaryText: '#303030',
  subduedText: '#A0A0A0',

  // ---- Border & Shadow ----
  border: 'rgba(0, 0, 0, 0.1)',
  borderActive: 'rgba(0, 123, 255, 0.25)',
  shadow: 'rgba(0, 123, 255, 0.05)',

  // ---- UI ----
  commandHighlight: '#FFC107',
  costText: '#007BFF',
  buttonText: '#FFFFFF',
  pathText: '#009688',
  backgroundOverlay: 'rgba(255, 255, 255, 0.5)',
  pulseAnimation: 'rgba(0, 150, 136, 0.05)',
  bubbleColor: 'rgba(0, 123, 255, 0.3)',
  codeFlowColor: 'rgba(0, 150, 136, 0.3)',
  matrixColor: 'rgba(0, 150, 136, 0.6)',

  // ---- Gradient ----
  rainbowGradient: [
    '#009688',
    '#007BFF',
    '#E91E63',
  ],

  syntax: {
    comment: '#A0A0A0',
    string: '#009688',
    keyword: '#007BFF',
    number: '#FFC107',
    className: '#007BFF',
    function: '#009688',
  },

  modes: {
    architect: '#007BFF',
    code: '#009688',
    debug: '#DC3545',
    task: '#007BFF',
    explain: '#FFC107',
  },

  fonts: {
    main: 'JetBrainsMono-Regular',
    title: 'Orbitron-Regular',
    architect: 'IBMPlexSerif-Regular',
    medium: 'System',
    monospace: 'JetBrainsMono-Regular',
  },
};





export const getModeStyles = (theme) => ({
	architect: {
		accent: theme.modes.architect,
		font: "IBMPlexSerif-Regular",
	},
	code: {
		accent: theme.modes.code,
		font: "JetBrainsMono-Regular",
	},
	debug: {
		accent: theme.modes.debug,
		font: "VictorMono-Regular",
	},
	task: {
		accent: theme.modes.task,
		font: "Inter-Regular",
	},
	explain: {
		accent: theme.modes.explain,
		font: "Sora-Regular",
	},
})