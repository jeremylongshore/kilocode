import React from 'react';
import { View } from 'react-native';
import CodeHighlighter from 'react-native-code-highlighter';
import js from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import 'highlight.js/styles/atom-one-dark.css'; // web-safe style

const languageMap = {
  js,
  javascript: js,
  json,
  py: python,
  python,
};

const CodeBlock = ({ language = 'js', code = '' }) => {
  const lang = languageMap[language] || js;

  return (
    <View style={{ backgroundColor: '#1e1e1e', borderRadius: 8, padding: 10 }}>
      <CodeHighlighter
        hljsStyle="atom-one-dark"
        language={lang}
        textStyle={{ fontFamily: 'monospace', color: '#ccc' }}
      >
        {String(code)}
      </CodeHighlighter>
    </View>
  );
};

export default CodeBlock;
