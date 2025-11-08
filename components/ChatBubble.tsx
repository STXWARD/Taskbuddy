import React from 'react';
import { Message, Role } from '../types';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  // Safely renders simple markdown (bold, italic, and links) into React elements.
  const renderMarkdown = (text: string) => {
    // This regex captures all supported markdown elements.
    const markdownRegex = /(\[.*?\]\(https?:\/\/[^\s]+\))|(\*\*\*.*?\*\*\*)|(\*\*.*?\*\*)|(\*.*?\*)/;

    // Process each line separately to preserve paragraph breaks.
    return text.split('\n').map((line, lineIndex) => {
      // Split the line by the markdown patterns.
      const parts = line.split(markdownRegex).filter(Boolean);
      
      // If the line is empty after splitting, render a non-breaking space to maintain height.
      if (parts.length === 0) {
        return <p key={lineIndex}>&nbsp;</p>;
      }

      return (
        <p key={lineIndex}>
          {parts.map((part, partIndex) => {
            // Match for link: [text](url)
            const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/[^\s]+)\)$/);
            if (linkMatch) {
              return (
                <a
                  key={partIndex}
                  href={linkMatch[2]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-accent-gradient text-white font-semibold px-4 py-2 rounded-lg mt-2 hover:opacity-90 transition-opacity duration-200 no-underline"
                >
                  🔗 {linkMatch[1]}
                </a>
              );
            }

            // Match for bold and italic: ***text***
            const boldItalicMatch = part.match(/^\*\*\*(.*?)\*\*\*$/);
            if (boldItalicMatch) {
              return <b key={partIndex}><i>{boldItalicMatch[1]}</i></b>;
            }

            // Match for bold: **text**
            const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
            if (boldMatch) {
              return <b key={partIndex}><b>{boldMatch[1]}</b></b>;
            }
            
            // Match for italic: *text*
            const italicMatch = part.match(/^\*(.*?)\*$/);
            if (italicMatch) {
              return <i key={partIndex}><i>{italicMatch[1]}</i></i>;
            }
            
            // If no markdown pattern matches, return the plain text part.
            return part;
          })}
        </p>
      );
    });
  };

  // Renders plain text for user messages, preserving line breaks.
  const renderPlainText = (text: string) => {
    return text.split('\n').map((line, index) => (
      <p key={index}>{line || <>&nbsp;</>}</p> // Render empty lines
    ));
  };

  return (
    <div
      className={`flex w-full items-start gap-3 animate-fade-in-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${isUser ? 'bg-user-bubble' : 'bg-accent-gradient'} flex-shrink-0 text-white font-semibold text-sm`}>
        {isUser ? 'You' : 'AI'}
      </div>
      <div
        className={`flex flex-col max-w-[80%] sm:max-w-[70%]`}
      >
        <div className={`p-3 px-4 rounded-2xl ${isUser ? 'bg-user-bubble text-text-primary' : 'bg-ai-bubble text-text-primary shadow-glow-blue'} text-base`}>
          {isUser ? renderPlainText(message.text) : renderMarkdown(message.text)}
        </div>
        <p className={`text-text-secondary text-xs mt-1.5 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;