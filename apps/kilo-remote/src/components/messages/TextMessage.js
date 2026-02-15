import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../hooks/useTheme';
import { getTextMessageStyles } from '../../styles';
import { getRandomVariant } from '../../utils/style-utils';
import { messageStyles } from '../../styles';
import MessageCard from './MessageCard';

const TextMessage = ({ item, text }) => {
  const { theme, isVerbose, expandedMessageId, setExpandedMessageId } = useTheme();
  const styles = useMemo(() => getTextMessageStyles(theme), [theme]);
  const isExpanded = expandedMessageId === item.ts;
  const isError = item.say === 'error';

  const handlePress = () => {
    setExpandedMessageId(isExpanded ? null : item.ts);
  };

  const kiloGreeting = useMemo(() => {
    return getRandomVariant(messageStyles.kiloSpeaks.variants);
  }, []);

  if (item.sender === 'user') {
    return (
      <Markdown style={{ ...styles.userMessage, paragraph: { margin: 0 } }}>
        {text}
      </Markdown>
    );
  }

  if (!isVerbose) {
    return (
      <TouchableWithoutFeedback onPress={() => { /* Stop propagation */ }}>
        <MessageCard isError={isError}>
          <TouchableOpacity onPress={handlePress}>
            <View style={!isExpanded && { maxHeight: 65, overflow: 'hidden' }}>
              <Markdown style={{ ...styles.kiloMessage, paragraph: { margin: 0 } }}>
                {text}
              </Markdown>
            </View>
          </TouchableOpacity>
        </MessageCard>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <MessageCard headerText={kiloGreeting} isError={isError}>
      <Markdown style={{ ...styles.kiloMessage, paragraph: { margin: 0 } }}>
        {text}
      </Markdown>
    </MessageCard>
  );
};

export default TextMessage;