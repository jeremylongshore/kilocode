import React from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { getKiloQuestionMessageStyles } from '../../styles';
import MessageCard from './MessageCard';

const KiloQuestionMessage = ({ item, onSelect }) => {
  const { theme, isVerbose, expandedMessageId, setExpandedMessageId } = useTheme();
  const isExpanded = expandedMessageId === item.ts;
  const styles = getKiloQuestionMessageStyles(theme);
  const question = JSON.parse(item.text);

  const handlePress = () => {
    setExpandedMessageId(isExpanded ? null : item.ts);
  };

  if (!isVerbose) {
    return (
      <TouchableWithoutFeedback onPress={() => { /* Stop propagation */ }}>
        <MessageCard>
          <TouchableOpacity onPress={handlePress}>
            <View style={styles.markdownContainer}>
              <View style={!isExpanded && { maxHeight: 65, overflow: 'hidden' }}>
                <Markdown
                  style={{
                    body: styles.markdownBody,
                    code_inline: styles.code_inline,
                    paragraph: { margin: 0 },
                  }}
                >
                  {question.question}
                </Markdown>
              </View>
              <View style={styles.answersContainer}>
                {question.suggest.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => onSelect?.(suggestion.answer)}
                    activeOpacity={0.7}
                    style={styles.suggestionButton}
                  >
                    <Text style={styles.suggestionText}>{suggestion.answer}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </MessageCard>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <MessageCard
      headerIcon={
        <Ionicons name="help-circle-outline" size={18} style={styles.icon} />
      }
      headerText="Kilo Code has a question"
    >
      <View style={styles.markdownContainer}>
        <Markdown
          style={{
            body: styles.markdownBody,
            code_inline: styles.code_inline,
            paragraph: { margin: 0 },
          }}
        >
          {question.question}
        </Markdown>

        <View style={styles.answersContainer}>
          {question.suggest.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => onSelect?.(suggestion.answer)}
              activeOpacity={0.7}
              style={styles.suggestionButton}
            >
              <Text style={styles.suggestionText}>{suggestion.answer}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </MessageCard>
  );
};

export default KiloQuestionMessage;
